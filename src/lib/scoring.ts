// Leadership Risk Intelligence™ — Scoring Engine v3.1
// VENTURE-GRADE CORRECTIONS:
//   #1  LSI_norm = LSI / 5  →  aligns all three variables to 0–1 range
//   #2  Risk Score = (CEI × LLI_norm) / LSI_norm  (not raw LSI)
//   #3  Cascade Stage classification uses Risk Score, not CEI alone
//   #4  Decision Velocity = total_decisions / days_elapsed

import type {
  SignalDomain, SignalPattern, CascadeStage, RiskLevel,
  TrajectoryDirection, RiskScoreResult,
} from '../types/index.js';
import { QUESTIONS, DOMAIN_META, DOMAIN_KEYS } from './questions.js';

// ─────────────────────────────────────────────────────────────
// MODEL 1: LEADERSHIP SIGNAL INDEX™
// Domain Score = Sum(domain responses) / n_questions  → range 1.0–5.0
// LSI = (SR + CB + TC + EI + LD + AC) / 6            → range 1.0–5.0
// LSI_norm = LSI / 5                                  → range 0.0–1.0
// ─────────────────────────────────────────────────────────────

export function computeDomainScore(
  domain: SignalDomain,
  responses: Map<string, number>
): number {
  const domainQs = QUESTIONS.filter(q => q.domain === domain && q.scored);
  if (domainQs.length === 0) return 0;
  let sum = 0;
  for (const q of domainQs) {
    const raw = responses.get(q.id) ?? 3;
    const value = q.reverse ? (6 - raw) : raw;
    sum += value;
  }
  return parseFloat((sum / domainQs.length).toFixed(3));
}

export function computeLSI(domainScores: Record<SignalDomain, number>): number {
  const values = DOMAIN_KEYS.map(k => domainScores[k]);
  const lsi = values.reduce((a, b) => a + b, 0) / values.length;
  return parseFloat(lsi.toFixed(3));
}

/** LSI_norm = LSI / 5  →  converts 1–5 scale to 0–1 for formula alignment */
export function normalizeLSI(lsi: number): number {
  return parseFloat((lsi / 5).toFixed(4));
}

export function computeDomainVariance(domainScores: Record<SignalDomain, number>): number {
  const values = DOMAIN_KEYS.map(k => domainScores[k]);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return parseFloat(Math.sqrt(variance).toFixed(3));
}

// ─────────────────────────────────────────────────────────────
// MODEL 2: LEADERSHIP LOAD INDEX™
// LLI_raw  = Sum(load_responses) / 5  → range 1.0–5.0
// LLI_norm = (LLI_raw - 1) / 4       → range 0.0–1.0
// ─────────────────────────────────────────────────────────────
export function computeLLI(responses: Map<string, number>): {
  lli_raw: number;
  lli_norm: number;
} {
  const loadQs = QUESTIONS.filter(q => q.domain === 'load' && q.scored);
  let sum = 0;
  for (const q of loadQs) {
    sum += responses.get(q.id) ?? 3;
  }
  const lli_raw  = parseFloat((sum / loadQs.length).toFixed(3));
  const lli_norm = parseFloat(((lli_raw - 1) / 4).toFixed(3));
  return { lli_raw, lli_norm };
}

// ─────────────────────────────────────────────────────────────
// MODEL 3: CONCENTRATION EXPOSURE INDEX™
// CEI = leader_decisions / total_decisions  → range 0.0–1.0
// ─────────────────────────────────────────────────────────────
export function computeCEI(
  leaderDecisions: number,
  totalDecisions: number
): number {
  if (totalDecisions === 0) return 0.35;
  return parseFloat((leaderDecisions / totalDecisions).toFixed(3));
}

// ─────────────────────────────────────────────────────────────
// MODEL 4: DECISION VELOCITY
// Velocity = total_decisions / days_elapsed
// Concentration Drag = velocity_baseline - velocity_current
// ─────────────────────────────────────────────────────────────
export function computeDecisionVelocity(
  totalDecisions: number,
  daysElapsed: number
): number {
  if (daysElapsed === 0) return 0;
  return parseFloat((totalDecisions / daysElapsed).toFixed(2));
}

export function computeVelocityDrag(
  baselineVelocity: number,
  currentVelocity: number
): number {
  if (baselineVelocity === 0) return 0;
  return parseFloat(((baselineVelocity - currentVelocity) / baselineVelocity).toFixed(3));
}

// ─────────────────────────────────────────────────────────────
// MODEL 5: LEADERSHIP RISK SCORE™  ← CORRECTED v3.1
//
// PREVIOUS (v3.0):  Risk = (CEI × LLI_norm) / LSI
// CORRECTED (v3.1): Risk = (CEI × LLI_norm) / LSI_norm
//                   where LSI_norm = LSI / 5
//
// This aligns all three variables to 0–1 range, improving
// interpretability and signal power.
// ─────────────────────────────────────────────────────────────
export function computeRiskScore(
  lsi: number,
  lli_norm: number,
  cei: number
): number {
  const lsi_norm = normalizeLSI(lsi);
  if (lsi_norm === 0) return 0;
  return parseFloat(((cei * lli_norm) / lsi_norm).toFixed(4));
}

// ─────────────────────────────────────────────────────────────
// RISK LEVEL BANDS  ← CORRECTED v3.1
// Using Risk Score (not CEI) with updated thresholds
// ─────────────────────────────────────────────────────────────
export const RISK_LEVELS: Array<{
  level: RiskLevel;
  range: [number, number];
  color: string;
  bg: string;
  textColor: string;
  description: string;
}> = [
  {
    level: 'Low Structural Risk',
    range: [0, 0.030],
    color: '#10B981', bg: '#ECFDF5', textColor: '#065F46',
    description: 'Leadership signals are strong and structural load is well-managed. No intervention required.',
  },
  {
    level: 'Early Exposure',
    range: [0.030, 0.080],
    color: '#84CC16', bg: '#F7FEE7', textColor: '#365314',
    description: 'Early risk indicators are present. Preventative attention is warranted.',
  },
  {
    level: 'Emerging Dependency',
    range: [0.080, 0.150],
    color: '#F59E0B', bg: '#FFFBEB', textColor: '#78350F',
    description: 'Structural dependency is forming. Active monitoring and load management recommended.',
  },
  {
    level: 'Structural Bottleneck',
    range: [0.150, 0.300],
    color: '#F97316', bg: '#FFF7ED', textColor: '#7C2D12',
    description: 'Decision throughput and organizational velocity are materially compromised.',
  },
  {
    level: 'Organizational Drag',
    range: [0.300, 999],
    color: '#EF4444', bg: '#FEF2F2', textColor: '#7F1D1D',
    description: 'Acute structural risk. Urgent intervention required. The risk is organizational, not personal.',
  },
];

export function classifyRiskLevel(riskScore: number): RiskLevel {
  if (riskScore < 0.030) return 'Low Structural Risk';
  if (riskScore < 0.080) return 'Early Exposure';
  if (riskScore < 0.150) return 'Emerging Dependency';
  if (riskScore < 0.300) return 'Structural Bottleneck';
  return 'Organizational Drag';
}

export function getRiskLevelMeta(riskScore: number) {
  return RISK_LEVELS.find(r => riskScore >= r.range[0] && riskScore < r.range[1])
    ?? RISK_LEVELS[RISK_LEVELS.length - 1];
}

// ─────────────────────────────────────────────────────────────
// MODEL 6: LEADERSHIP COST CASCADE™  ← CORRECTED v3.1
//
// PREVIOUS (v3.0): Stage classified by CEI alone
// CORRECTED (v3.1): Stage classified by Risk Score
//
// This makes cascade reflect TRUE structural risk (composite of
// signals, load, and concentration) — not just concentration alone.
// ─────────────────────────────────────────────────────────────
export const CASCADE_STAGES: Array<{
  level: number;
  stage: CascadeStage;
  riskRange: [number, number];  // Risk Score thresholds (not CEI)
  color: string;
  bg: string;
  textColor: string;
  description: string;
  action: string;
}> = [
  {
    level: 1,
    stage: 'Healthy Distribution',
    riskRange: [0.000, 0.030],
    color: '#10B981', bg: '#ECFDF5', textColor: '#065F46',
    description: 'Decision load is well distributed. Leadership capacity is not structurally constrained.',
    action: 'Maintain current structure. Continue monitoring via quarterly assessments.',
  },
  {
    level: 2,
    stage: 'Early Exposure',
    riskRange: [0.030, 0.080],
    color: '#84CC16', bg: '#F7FEE7', textColor: '#365314',
    description: 'Early concentration signals appearing. Preventative attention is warranted.',
    action: 'Review decision routing patterns. Begin documenting escalation triggers.',
  },
  {
    level: 3,
    stage: 'Emerging Dependency',
    riskRange: [0.080, 0.150],
    color: '#F59E0B', bg: '#FFFBEB', textColor: '#78350F',
    description: 'Organization is structurally dependent on this leader for decision resolution.',
    action: 'Initiate delegation architecture review. Map top 10 decision categories for redistribution.',
  },
  {
    level: 4,
    stage: 'Structural Bottleneck',
    riskRange: [0.150, 0.300],
    color: '#F97316', bg: '#FFF7ED', textColor: '#7C2D12',
    description: 'Decision throughput is critically constrained. Organizational velocity is compromised.',
    action: 'Immediate structural intervention. Implement decision rights framework within 30 days.',
  },
  {
    level: 5,
    stage: 'Organizational Drag',
    riskRange: [0.300, 999],
    color: '#EF4444', bg: '#FEF2F2', textColor: '#7F1D1D',
    description: 'Risk Score indicates systemic structural failure. Organizational performance is at acute risk.',
    action: 'Urgent advisory engagement. Load reduction, succession, and structural redesign are required immediately.',
  },
];

export function computeCascadeStage(riskScore: number): {
  stage: CascadeStage;
  level: number;
  stageMeta: typeof CASCADE_STAGES[0];
} {
  const stageMeta = CASCADE_STAGES.find(
    s => riskScore >= s.riskRange[0] && riskScore < s.riskRange[1]
  ) ?? CASCADE_STAGES[CASCADE_STAGES.length - 1];
  return { stage: stageMeta.stage, level: stageMeta.level, stageMeta };
}

// ─────────────────────────────────────────────────────────────
// SIGNAL PATTERN CLASSIFICATION
// ─────────────────────────────────────────────────────────────
export const SIGNAL_PATTERN_META: Record<SignalPattern, {
  description: string;
  color: string;
  icon: string;
  implication: string;
}> = {
  'Organizational Stabilizer': {
    description: 'High LSI with low domain variance. Signals are strong and consistent across all domains.',
    color: '#10B981',
    icon: 'anchor',
    implication: 'This leader creates organizational stability. Structural risk is low when load and exposure are managed.',
  },
  'Strategic Interpreter': {
    description: 'High Cognitive Breadth combined with High Ethical Integrity. Strong translational leadership capability.',
    color: '#6366F1',
    icon: 'lightbulb',
    implication: 'This leader excels at converting ambiguity into organizational direction. Watch for load saturation.',
  },
  'Structural Bottleneck Risk': {
    description: 'High Load combined with rising Concentration Exposure. Decision routing is centralizing.',
    color: '#F97316',
    icon: 'triangle-exclamation',
    implication: 'Decision concentration is structurally compressing the organization. Delegation architecture is needed.',
  },
  'Leadership Load Saturation': {
    description: 'High Load combined with Low Durability score. Capacity erosion is accelerating.',
    color: '#EF4444',
    icon: 'battery-quarter',
    implication: 'Leadership capacity is approaching saturation. Without structural relief, performance decline is probable.',
  },
};

export function classifySignalPattern(
  domainScores: Record<SignalDomain, number>,
  lsi: number,
  domainVariance: number,
  lli_norm: number,
  cei: number
): SignalPattern {
  const ld = domainScores.leadership_durability;
  const cb = domainScores.cognitive_breadth;
  const ei = domainScores.ethical_integrity;

  if (lli_norm >= 0.55 && ld < 3.0)  return 'Leadership Load Saturation';
  if (lli_norm >= 0.50 && cei >= 0.46) return 'Structural Bottleneck Risk';
  if (lsi >= 3.8 && domainVariance < 0.5) return 'Organizational Stabilizer';
  if (cb >= 3.8 && ei >= 3.8)         return 'Strategic Interpreter';
  if (lli_norm >= 0.50)               return 'Structural Bottleneck Risk';
  return 'Organizational Stabilizer';
}

// ─────────────────────────────────────────────────────────────
// TRAJECTORY
// ─────────────────────────────────────────────────────────────
export function computeTrajectory(
  currentRiskScore: number,
  historicalScores: number[]
): TrajectoryDirection {
  if (historicalScores.length === 0) return 'Stable';
  const avgHistorical = historicalScores.reduce((a, b) => a + b, 0) / historicalScores.length;
  const delta = currentRiskScore - avgHistorical;
  if (delta < -0.005) return 'Improving';
  if (delta > 0.005)  return 'Declining';
  return 'Stable';
}

// ─────────────────────────────────────────────────────────────
// MASTER SCORING FUNCTION
// ─────────────────────────────────────────────────────────────
export function computeFullRiskScore(
  responses: Map<string, number>,
  ceiLeaderDecisions: number = 38,
  ceiTotalDecisions:  number = 100,
  historicalRiskScores: number[] = []
): RiskScoreResult {
  // 1. Domain scores
  const domainScores = {} as Record<SignalDomain, number>;
  for (const domain of DOMAIN_KEYS) {
    domainScores[domain] = computeDomainScore(domain, responses);
  }

  // 2. LSI + LSI_norm
  const lsi      = computeLSI(domainScores);
  const lsi_norm = normalizeLSI(lsi);
  const domain_variance = computeDomainVariance(domainScores);

  // 3. LLI
  const { lli_raw, lli_norm } = computeLLI(responses);

  // 4. CEI
  const cei = computeCEI(ceiLeaderDecisions, ceiTotalDecisions);

  // 5. Risk Score (uses LSI_norm, not raw LSI)
  const risk_score = computeRiskScore(lsi, lli_norm, cei);
  const risk_level = classifyRiskLevel(risk_score);

  // 6. Cascade stage (now driven by Risk Score, not CEI)
  const { stage: cascade_stage, level: cascade_level } = computeCascadeStage(risk_score);

  // 7. Signal pattern
  const signal_pattern = classifySignalPattern(domainScores, lsi, domain_variance, lli_norm, cei);

  // 8. Trajectory
  const trajectory_direction = computeTrajectory(risk_score, historicalRiskScores);

  return {
    ...domainScores,
    lsi,
    lsi_norm,
    domain_variance,
    signal_pattern,
    lli_raw,
    lli_norm,
    cei,
    cascade_stage,
    cascade_level,
    risk_score,
    risk_level,
    trajectory_direction,
  };
}
