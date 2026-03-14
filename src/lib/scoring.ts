// Leadership Signal Index™ — Signal Scoring Engine (Core IP)
// Multi-Layer Signal Evaluation Engine

import type {
  Domain,
  Band,
  RiskTier,
  InterventionType,
  IndexScore,
  SignalScores,
  InterventionPlan,
  TierDefinition,
} from '../types/index.js';
import { QUESTIONS } from './questions.js';

// ──────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────

export const BAND_THRESHOLDS: Record<Band, [number, number]> = {
  Exceptional:  [90, 100],
  Strong:       [75, 89],
  Adequate:     [60, 74],
  Developing:   [45, 59],
  'At-Risk':    [30, 44],
  Critical:     [0, 29],
};

export const TIER_DEFINITIONS: TierDefinition[] = [
  {
    tier: 'Green',
    label: 'Leadership Ready',
    range: [75, 100],
    color: '#10B981',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    description: 'Signal integrity is high. No significant concentration or drift detected. Leadership capacity is functioning within healthy parameters.',
  },
  {
    tier: 'Yellow',
    label: 'Monitor & Develop',
    range: [55, 74],
    color: '#F59E0B',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    description: 'Some domain softness detected. No acute risk, but preventative attention is warranted to avoid drift acceleration.',
  },
  {
    tier: 'Orange',
    label: 'Active Intervention',
    range: [35, 54],
    color: '#F97316',
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    description: 'Multiple domains showing concentration signatures. Corrective intervention is recommended before structural breakdown occurs.',
  },
  {
    tier: 'Red',
    label: 'Critical Risk',
    range: [0, 34],
    color: '#EF4444',
    bg: 'bg-red-50',
    text: 'text-red-800',
    description: 'Acute leadership risk detected. Convergence of multiple failure signals. Urgent advisory engagement required.',
  },
];

// ──────────────────────────────────────────────
// CALIBRATION CURVES BY ORG STAGE
// Contextual Calibration Engine
// ──────────────────────────────────────────────
const STAGE_CALIBRATION: Record<string, Record<Domain, number>> = {
  early_vc: {
    operational: 0.85, // Lower bar: early stage expects concentration
    cognitive:   1.10, // Higher expectation: founders need broad thinking
    ethical:     1.00,
    trust:       0.90,
    adaptive:    1.15, // Critical in early stage
    durability:  0.90,
  },
  growth_vc: {
    operational: 1.00,
    cognitive:   1.05,
    ethical:     1.00,
    trust:       1.05,
    adaptive:    1.05,
    durability:  1.00,
  },
  enterprise: {
    operational: 1.10, // Delegation expected at enterprise level
    cognitive:   1.00,
    ethical:     1.10, // Higher ethical standard
    trust:       1.10, // Psychological safety critical
    adaptive:    0.95,
    durability:  1.05,
  },
};

// ──────────────────────────────────────────────
// MODULE 1: DOMAIN SCORING ENGINE
// Weighted item aggregation + anchor item prioritization
// ──────────────────────────────────────────────
function computeDomainRawScore(
  domain: Domain,
  responses: Map<string, number>
): { raw: number; anchorBonus: number } {
  const domainQuestions = QUESTIONS.filter(q => q.domain === domain);
  let weightedSum = 0;
  let totalWeight = 0;
  let anchorBonus = 0;

  for (const q of domainQuestions) {
    const rawVal = responses.get(q.id);
    if (rawVal === undefined) continue;

    // Normalize to 0-100 (from 1-7 scale)
    const normalized = ((rawVal - 1) / 6) * 100;
    const value = q.is_reverse ? (100 - normalized) : normalized;

    // Anchor item gets 20% weight boost
    const effectiveWeight = q.is_anchor ? q.weight * 1.2 : q.weight;

    weightedSum += value * effectiveWeight;
    totalWeight += effectiveWeight;

    // Track anchor divergence for coherence scoring
    if (q.is_anchor) {
      anchorBonus += value;
    }
  }

  const anchorCount = domainQuestions.filter(q => q.is_anchor).length;
  return {
    raw: totalWeight > 0 ? weightedSum / totalWeight : 50,
    anchorBonus: anchorCount > 0 ? anchorBonus / anchorCount : 50,
  };
}

// ──────────────────────────────────────────────
// MODULE 2: COHERENCE SCORING
// Cross-item consistency + confidence rating
// ──────────────────────────────────────────────
function computeCoherence(
  domain: Domain,
  responses: Map<string, number>
): { consistency: number; confidence: number } {
  const domainQuestions = QUESTIONS.filter(q => q.domain === domain);
  const values: number[] = [];

  for (const q of domainQuestions) {
    const rawVal = responses.get(q.id);
    if (rawVal === undefined) continue;
    const normalized = ((rawVal - 1) / 6) * 100;
    values.push(q.is_reverse ? (100 - normalized) : normalized);
  }

  if (values.length < 2) return { consistency: 0.5, confidence: 0.5 };

  // Standard deviation-based consistency: lower spread = higher consistency
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Consistency: StdDev 0 = 1.0, StdDev 50 = 0.0
  const consistency = Math.max(0, Math.min(1, 1 - (stdDev / 50)));

  // Confidence also penalizes extreme responding
  const extremeCount = values.filter(v => v <= 5 || v >= 95).length;
  const extremePenalty = extremeCount / values.length;
  const confidence = Math.max(0.2, consistency - (extremePenalty * 0.3));

  return { consistency, confidence };
}

// ──────────────────────────────────────────────
// MODULE 3: CONTEXTUAL CALIBRATION ENGINE
// Stage-based normalization
// ──────────────────────────────────────────────
function applyContextualCalibration(
  rawScore: number,
  domain: Domain,
  orgStage: string
): number {
  const multiplier = STAGE_CALIBRATION[orgStage]?.[domain] ?? 1.0;
  // Apply multiplier then clamp to 0-100
  return Math.max(0, Math.min(100, rawScore * multiplier));
}

// ──────────────────────────────────────────────
// MODULE 4: BAND CLASSIFIER
// ──────────────────────────────────────────────
function classifyBand(score: number): Band {
  for (const [band, [min, max]] of Object.entries(BAND_THRESHOLDS) as [Band, [number, number]][]) {
    if (score >= min && score <= max) return band;
  }
  return 'Critical';
}

// ──────────────────────────────────────────────
// MODULE 5: CONVERGENCE DETECTION MODULE
// Cross-domain convergence flags
// ──────────────────────────────────────────────
function detectConvergence(domainScores: Record<Domain, number>): {
  convergence_flag: boolean;
  concentration_signature: boolean;
  drift_acceleration: boolean;
  protective_buffer: boolean;
} {
  const scores = Object.values(domainScores);
  const lowDomains = scores.filter(s => s < 50).length;
  const criticalDomains = scores.filter(s => s < 35).length;
  const highDomains = scores.filter(s => s >= 75).length;

  // Concentration signature: 3+ domains below 50
  const concentration_signature = lowDomains >= 3;

  // Convergence flag: 2+ domains critically low
  const convergence_flag = criticalDomains >= 2;

  // Drift acceleration: spread between best and worst > 40 points (imbalance)
  const spread = Math.max(...scores) - Math.min(...scores);
  const drift_acceleration = spread > 40 && lowDomains >= 2;

  // Protective buffer: 3+ domains above 75 (acts as buffer against risk)
  const protective_buffer = highDomains >= 3;

  return { convergence_flag, concentration_signature, drift_acceleration, protective_buffer };
}

// ──────────────────────────────────────────────
// MODULE 6: TIER ASSIGNMENT ENGINE
// ──────────────────────────────────────────────
function assignTier(
  composite: number,
  convergenceFlags: ReturnType<typeof detectConvergence>
): { tier: RiskTier; tier_label: string } {
  let adjustedComposite = composite;

  // Convergence penalties
  if (convergenceFlags.convergence_flag) adjustedComposite -= 10;
  if (convergenceFlags.concentration_signature) adjustedComposite -= 5;
  if (convergenceFlags.drift_acceleration) adjustedComposite -= 5;

  // Protective buffer bonus
  if (convergenceFlags.protective_buffer) adjustedComposite += 5;

  adjustedComposite = Math.max(0, Math.min(100, adjustedComposite));

  const tierDef = TIER_DEFINITIONS.find(
    t => adjustedComposite >= t.range[0] && adjustedComposite <= t.range[1]
  ) ?? TIER_DEFINITIONS[TIER_DEFINITIONS.length - 1];

  return { tier: tierDef.tier, tier_label: tierDef.label };
}

// ──────────────────────────────────────────────
// MODULE 7: INTERVENTION WINDOW CLASSIFICATION
// Revenue architecture — every profile produces intervention type
// ──────────────────────────────────────────────
function generateIntervention(tier: RiskTier, domainScores: Record<Domain, number>): InterventionPlan {
  const weakDomains = (Object.entries(domainScores) as [Domain, number][])
    .filter(([, s]) => s < 60)
    .map(([d]) => d);

  if (tier === 'Red') {
    return {
      type: 'urgent',
      title: 'Urgent Advisory Engagement',
      description: 'Critical convergence of leadership risk signals detected. Immediate structured advisory intervention is required.',
      self_guided: [
        'Identify and temporarily redistribute 3–5 key decisions that currently require your direct input',
        'Schedule immediate 1:1 candid conversations with your 2 most trusted direct reports',
        'Audit your last 2 weeks of decisions for patterns of reactive rather than strategic behavior',
      ],
      facilitated: [
        'Structured leadership debrief with an executive coach (within 1 week)',
        'Organizational dependency audit — map where decisions are bottlenecking',
        'Team climate assessment to identify trust erosion early',
      ],
      advisory_option: 'Leadership Signal Index™ Advisory Retainer — Intensive 90-day re-stabilization program with bi-weekly coaching, signal re-assessment at day 45, and structural intervention support.',
      urgency_note: 'Without intervention, current signal trajectory suggests structural leadership breakdown within 60–90 days.',
    };
  }

  if (tier === 'Orange') {
    return {
      type: 'corrective',
      title: 'Corrective Intervention Recommended',
      description: 'Multiple domains showing concentration signatures. Structural corrective action recommended before risk accelerates.',
      self_guided: [
        'Review your delegation map — identify 3 decisions you should stop owning',
        'Block 2 hours per week for strategic reflection (non-operational)',
        `Focus development attention on: ${weakDomains.slice(0, 2).map(formatDomainName).join(', ')}`,
      ],
      facilitated: [
        '360° leadership input from direct reports and peers',
        'Facilitated team norms session to recalibrate expectations',
        'Leadership index re-assessment in 60 days to track trajectory',
      ],
      advisory_option: 'Leadership Signal Index™ Advisory Package — 60-day corrective engagement with bi-weekly advisory sessions and mid-cycle re-assessment.',
    };
  }

  if (tier === 'Yellow') {
    return {
      type: 'preventative',
      title: 'Preventative Development Plan',
      description: 'Domain softness detected. Preventative attention recommended to avoid drift acceleration.',
      self_guided: [
        'Identify which of your leadership habits may be becoming dependencies',
        `Invest deliberate development time in: ${weakDomains.slice(0, 2).map(formatDomainName).join(', ')}`,
        'Reassess your leadership context — have org demands shifted since your last reflection?',
      ],
      facilitated: [
        'Optional: structured peer leadership dialogue',
        'Consider a 45-day check-in reassessment to validate trajectory',
      ],
      advisory_option: 'Leadership Signal Index™ Quarterly Monitoring — Ongoing signal tracking with annual deep-dive and trend analytics.',
    };
  }

  // Green
  return {
    type: 'preventative',
    title: 'Maintain & Sustain Plan',
    description: 'Leadership signal integrity is high. Focus on maintaining current conditions and building longitudinal data.',
    self_guided: [
      'Document what is working in your leadership system — these are your buffers',
      'Schedule a 90-day re-assessment to maintain longitudinal signal data',
      'Consider mentoring or developing emerging leaders in your organization',
    ],
    facilitated: [
      'Optional: Leadership Signal Index™ benchmark comparison at 6 months',
    ],
    advisory_option: 'Leadership Signal Index™ Annual Excellence Package — Annual deep-dive + benchmark comparison against portfolio/industry peers.',
  };
}

function formatDomainName(d: Domain): string {
  const names: Record<Domain, string> = {
    operational: 'Operational Stability',
    cognitive: 'Cognitive Breadth',
    ethical: 'Ethical Integrity',
    trust: 'Trust Climate',
    adaptive: 'Adaptive Capacity',
    durability: 'Leadership Durability',
  };
  return names[d] ?? d;
}

// ──────────────────────────────────────────────
// RESPONSE INTEGRITY FILTERS
// ──────────────────────────────────────────────
export function checkResponseIntegrity(responses: Map<string, number>): {
  passed: boolean;
  consistency_index: number;
  extreme_responding: boolean;
  pattern_contradiction: boolean;
  low_effort_flag: boolean;
} {
  const values = Array.from(responses.values());
  if (values.length === 0) return {
    passed: false,
    consistency_index: 0,
    extreme_responding: false,
    pattern_contradiction: false,
    low_effort_flag: false,
  };

  // Extreme responding: >50% of answers at extreme ends (1 or 7)
  const extremeCount = values.filter(v => v === 1 || v === 7).length;
  const extreme_responding = extremeCount / values.length > 0.5;

  // Low effort: all same value (straight-lining)
  const uniqueValues = new Set(values).size;
  const low_effort_flag = uniqueValues <= 2;

  // Pattern contradiction: check reverse-scored items
  // If forward+reverse pairs are both high or both low, flag contradiction
  let contradictions = 0;
  const domains = ['operational', 'cognitive', 'ethical', 'trust', 'adaptive', 'durability'] as Domain[];
  for (const domain of domains) {
    const domainQs = QUESTIONS.filter(q => q.domain === domain);
    const forward = domainQs.filter(q => !q.is_reverse).map(q => responses.get(q.id) ?? 4);
    const reverse = domainQs.filter(q => q.is_reverse).map(q => responses.get(q.id) ?? 4);
    const fwdAvg = forward.reduce((a, b) => a + b, 0) / (forward.length || 1);
    const revAvg = reverse.reduce((a, b) => a + b, 0) / (reverse.length || 1);
    // Both forward and reverse high = contradiction (reverse items should score opposite)
    if (fwdAvg > 5.5 && revAvg > 5.5) contradictions++;
    if (fwdAvg < 2.5 && revAvg < 2.5) contradictions++;
  }
  const pattern_contradiction = contradictions >= 2;

  // Consistency index: inverse of overall variance
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  const consistency_index = Math.max(0, Math.min(1, 1 - (Math.sqrt(variance) / 3)));

  const passed = !extreme_responding && !low_effort_flag && !pattern_contradiction && consistency_index > 0.3;

  return { passed, consistency_index, extreme_responding, pattern_contradiction, low_effort_flag };
}

// ──────────────────────────────────────────────
// MAIN SCORING FUNCTION — Full Signal Engine
// ──────────────────────────────────────────────
export function computeSignalScores(
  responses: Map<string, number>,
  orgStage: string = 'enterprise'
): Omit<SignalScores, 'assessment_id' | 'leader_id' | 'created_at'> {
  const domains: Domain[] = ['operational', 'cognitive', 'ethical', 'trust', 'adaptive', 'durability'];

  const rawScores: Record<Domain, number> = {} as Record<Domain, number>;
  const calibratedScores: Record<Domain, number> = {} as Record<Domain, number>;
  const confidenceScores: Record<Domain, number> = {} as Record<Domain, number>;
  const bandClassifications: Record<Domain, Band> = {} as Record<Domain, Band>;

  for (const domain of domains) {
    const { raw } = computeDomainRawScore(domain, responses);
    const { confidence } = computeCoherence(domain, responses);
    const calibrated = applyContextualCalibration(raw, domain, orgStage);

    rawScores[domain] = raw;
    calibratedScores[domain] = calibrated;
    confidenceScores[domain] = confidence;
    bandClassifications[domain] = classifyBand(calibrated);
  }

  // Composite score (weighted average with durability and trust weighted higher)
  const compositeWeights: Record<Domain, number> = {
    operational: 1.0,
    cognitive:   1.0,
    ethical:     1.2,
    trust:       1.1,
    adaptive:    1.0,
    durability:  1.1,
  };

  let weightedTotal = 0;
  let totalWeightSum = 0;
  for (const domain of domains) {
    weightedTotal += calibratedScores[domain] * compositeWeights[domain];
    totalWeightSum += compositeWeights[domain];
  }
  const lsi_composite = Math.round(weightedTotal / totalWeightSum);

  // Convergence detection
  const convergenceFlags = detectConvergence(calibratedScores);

  // Tier assignment
  const { tier, tier_label } = assignTier(lsi_composite, convergenceFlags);

  // Intervention window generation
  const intervention_plan = generateIntervention(tier, calibratedScores);

  // Reason codes
  const reason_codes: string[] = [];
  if (calibratedScores.operational < 50) reason_codes.push('CONCENTRATION_RISK: Leader-dependent execution detected');
  if (calibratedScores.cognitive < 50) reason_codes.push('COGNITIVE_COMPRESSION: Strategic thinking bandwidth constrained');
  if (calibratedScores.ethical < 60) reason_codes.push('INTEGRITY_PRESSURE: Value-behavior gap risk elevated');
  if (calibratedScores.trust < 50) reason_codes.push('TRUST_EROSION: Team safety and signal fidelity declining');
  if (calibratedScores.adaptive < 50) reason_codes.push('ADAPTATION_LAG: Change pace exceeding recalibration capacity');
  if (calibratedScores.durability < 50) reason_codes.push('DURABILITY_DEPLETION: Sustained performance capacity at risk');
  if (convergenceFlags.concentration_signature) reason_codes.push('MULTI_DOMAIN_CONVERGENCE: 3+ domains below threshold');
  if (convergenceFlags.drift_acceleration) reason_codes.push('DRIFT_ACCELERATION: Imbalanced domain spread detected');
  if (convergenceFlags.protective_buffer) reason_codes.push('BUFFER_ACTIVE: 3+ high-performing domains providing resilience');

  return {
    operational_stability: {
      score: Math.round(calibratedScores.operational),
      band: bandClassifications.operational,
      confidence: Math.round(confidenceScores.operational * 100) / 100,
      reason_codes: reason_codes.filter(r => r.includes('CONCENTRATION') || r.includes('OPERATIONAL')),
    },
    cognitive_breadth: {
      score: Math.round(calibratedScores.cognitive),
      band: bandClassifications.cognitive,
      confidence: Math.round(confidenceScores.cognitive * 100) / 100,
      reason_codes: reason_codes.filter(r => r.includes('COGNITIVE')),
    },
    ethical_integrity: {
      score: Math.round(calibratedScores.ethical),
      band: bandClassifications.ethical,
      confidence: Math.round(confidenceScores.ethical * 100) / 100,
      reason_codes: reason_codes.filter(r => r.includes('INTEGRITY')),
    },
    trust_climate: {
      score: Math.round(calibratedScores.trust),
      band: bandClassifications.trust,
      confidence: Math.round(confidenceScores.trust * 100) / 100,
      reason_codes: reason_codes.filter(r => r.includes('TRUST')),
    },
    adaptive_capacity: {
      score: Math.round(calibratedScores.adaptive),
      band: bandClassifications.adaptive,
      confidence: Math.round(confidenceScores.adaptive * 100) / 100,
      reason_codes: reason_codes.filter(r => r.includes('ADAPTATION') || r.includes('DRIFT')),
    },
    leadership_durability: {
      score: Math.round(calibratedScores.durability),
      band: bandClassifications.durability,
      confidence: Math.round(confidenceScores.durability * 100) / 100,
      reason_codes: reason_codes.filter(r => r.includes('DURABILITY')),
    },
    lsi_composite,
    ...convergenceFlags,
    tier,
    tier_label,
    intervention_type: intervention_plan.type,
    intervention_plan,
  };
}
