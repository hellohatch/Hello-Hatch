// ═══════════════════════════════════════════════════════════════════════
// Structural Intervention Engine™  v1.0
// Leadership Risk Intelligence™ Platform — Hatch
//
// Transforms the platform from DIAGNOSTIC → PREDICTIVE
//
// Architecture:
//   1. DETECTION   — identify which structural failure pattern is active
//   2. DIAGNOSIS   — quantify severity, trajectory, compounding factors
//   3. PRESCRIPTION— recommend intervention type, timeline, expected delta
//   4. PROJECTION  — model risk score in 30/60/90 days with vs. without action
//
// The four primary structural failure patterns:
//   A. Delegation Deficit        — high CEI, low load-sharing, decision accumulation
//   B. Decision Routing Overload — high LLI_norm, velocity compression, queue saturation
//   C. Recovery Cycle Compression— low durability + high load, no recovery capacity
//   D. Executive Dependency      — org-level pattern: multiple leaders converging high CEI
// ═══════════════════════════════════════════════════════════════════════

import type { RiskScoreResult, SignalDomain, RiskLevel, CascadeStage } from '../types/index.js';
import { CASCADE_STAGES } from './scoring.js';

// ───────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────

export type StructuralPattern =
  | 'Delegation Deficit'
  | 'Decision Routing Overload'
  | 'Recovery Cycle Compression'
  | 'Executive Dependency Pattern'
  | 'Compound Structural Failure';

export type InterventionType =
  | 'Decision Rights Redesign'
  | 'Load Redistribution Protocol'
  | 'Capacity Recovery Program'
  | 'Succession Architecture'
  | 'Delegation Capability Build'
  | 'Structural Role Redesign'
  | 'Executive Team Rebalancing';

export type UrgencyLevel = 'Monitor' | 'Preventative' | 'Active' | 'Critical' | 'Acute';
export type ConfidenceLevel = 'Low' | 'Moderate' | 'High' | 'Very High';

export interface StructuralSignal {
  pattern: StructuralPattern;
  label: string;             // Short display label, e.g. "Delegation deficit detected"
  description: string;       // Clinical one-sentence diagnosis
  evidence: string[];        // Data points that triggered the detection
  severity: number;          // 0–1 composite severity
  urgency: UrgencyLevel;
  confidence: ConfidenceLevel;
  color: string;
  icon: string;
}

export interface Intervention {
  id: string;
  type: InterventionType;
  title: string;
  rationale: string;
  actions: InterventionAction[];
  time_to_escalation_days: number;   // Days until next cascade stage if no action
  expected_risk_reduction: number;   // Expected Δ in risk score (absolute)
  expected_risk_pct: number;         // Expected % reduction
  implementation_weeks: number;      // Weeks to full implementation
  effort: 'Low' | 'Medium' | 'High';
  owner: string;                     // Who drives this: "Leader", "CHRO", "CEO", "Board"
  priority: number;                  // 1 = most urgent
}

export interface InterventionAction {
  week: number;
  action: string;
  metric: string;   // What to measure to confirm progress
}

export interface RiskProjection {
  scenario: 'No Action' | 'With Intervention';
  day_0:  number;
  day_30: number;
  day_60: number;
  day_90: number;
  label: string;
  color: string;
}

export interface InterventionReport {
  // Detection layer
  signals: StructuralSignal[];
  primary_pattern: StructuralPattern | null;
  is_compound: boolean;

  // Prescription layer
  interventions: Intervention[];
  primary_intervention: Intervention | null;

  // Projection layer
  projections: RiskProjection[];

  // Summary
  time_to_next_cascade_days: number | null;
  estimated_cost_of_inaction: string;
  system_recommendation: string;
  escalation_probability_90d: number;   // 0–1
}

// ───────────────────────────────────────────────
// DETECTION LAYER
// Threshold constants — calibrated for v3.1 formula
// ───────────────────────────────────────────────

const THRESHOLD = {
  // Delegation Deficit
  CEI_HIGH:         0.18,   // CEI > 18% indicates accumulation
  CEI_CRITICAL:     0.25,   // CEI > 25% is structural bottleneck territory
  LD_LOW:           3.2,    // Leadership Durability below this = capacity risk
  // Routing Overload
  LLI_HIGH:         0.60,
  LLI_CRITICAL:     0.80,
  VELOCITY_DROP:    0.30,   // 30% drop in decisions/day vs. expected
  // Recovery Compression
  LD_DEPLETED:      2.8,
  SR_LOW:           3.0,    // Stress Regulation below this
  LLI_RECOVERY_RISK:0.70,   // Combined with low LD = recovery risk
  // Signal floor
  LSI_LOW:          3.0,    // LSI below this = broad signal weakness
  DOMAIN_VARIANCE_HIGH: 0.8, // High variance = unstable signal profile
} as const;

// ───────────────────────────────────────────────
// PATTERN A: DELEGATION DEFICIT
// CEI is high → decisions are funneling to this leader
// not because they're able, but because the system has no alternative path
// ───────────────────────────────────────────────
function detectDelegationDeficit(scores: RiskScoreResult): StructuralSignal | null {
  const { cei, lli_norm, lsi, risk_score } = scores;
  const ld = scores.leadership_durability;

  if (cei < THRESHOLD.CEI_HIGH) return null;

  const severity = Math.min(1, (cei - THRESHOLD.CEI_HIGH) / (1 - THRESHOLD.CEI_HIGH) * 1.5);
  const isCritical = cei >= THRESHOLD.CEI_CRITICAL;

  const evidence: string[] = [
    `CEI = ${(cei * 100).toFixed(1)}% — ${isCritical ? 'critical' : 'elevated'} decision concentration`,
    `Risk Score = ${risk_score.toFixed(3)} — delegation gap is compressing throughput`,
  ];
  if (ld < THRESHOLD.LD_LOW) evidence.push(`Leadership Durability = ${ld.toFixed(1)} — capacity erosion accelerating`);
  if (lli_norm > 0.55) evidence.push(`LLI_norm = ${lli_norm.toFixed(2)} — load validates concentration is structural, not voluntary`);

  return {
    pattern: 'Delegation Deficit',
    label: 'Delegation deficit detected',
    description: `${(cei * 100).toFixed(0)}% of organizational decisions are routing through this leader — structural delegation capacity is insufficient.`,
    evidence,
    severity,
    urgency: isCritical ? 'Critical' : cei > 0.20 ? 'Active' : 'Preventative',
    confidence: lli_norm > 0.55 ? 'Very High' : severity > 0.5 ? 'High' : 'Moderate',
    color: isCritical ? '#EF4444' : '#F97316',
    icon: 'filter',
  };
}

// ───────────────────────────────────────────────
// PATTERN B: DECISION ROUTING OVERLOAD
// LLI_norm is high → the leader is saturated with decision load
// velocity is compressing → throughput is declining
// ───────────────────────────────────────────────
function detectDecisionRoutingOverload(scores: RiskScoreResult): StructuralSignal | null {
  const { lli_norm, cei, risk_score } = scores;
  const cb = scores.cognitive_breadth;

  if (lli_norm < THRESHOLD.LLI_HIGH) return null;

  const severity = Math.min(1, (lli_norm - THRESHOLD.LLI_HIGH) / (1 - THRESHOLD.LLI_HIGH) * 1.8);
  const isCritical = lli_norm >= THRESHOLD.LLI_CRITICAL;

  const evidence: string[] = [
    `LLI_norm = ${lli_norm.toFixed(2)} — ${isCritical ? 'critical' : 'high'} decision processing load`,
    `Risk Score = ${risk_score.toFixed(3)} — load is the primary risk driver`,
  ];
  if (cei > 0.15) evidence.push(`CEI = ${(cei * 100).toFixed(0)}% — concentration amplifying overload`);
  if (cb < 3.5) evidence.push(`Cognitive Breadth = ${cb.toFixed(1)} — reduced capacity to triage incoming decisions`);

  return {
    pattern: 'Decision Routing Overload',
    label: 'Decision routing overload',
    description: `Leadership load index at ${(lli_norm * 100).toFixed(0)}% of capacity — decision queue is exceeding sustainable throughput.`,
    evidence,
    severity,
    urgency: isCritical ? 'Acute' : lli_norm > 0.70 ? 'Critical' : 'Active',
    confidence: cei > 0.15 ? 'Very High' : 'High',
    color: isCritical ? '#DC2626' : '#EF4444',
    icon: 'network-wired',
  };
}

// ───────────────────────────────────────────────
// PATTERN C: RECOVERY CYCLE COMPRESSION
// Low durability + high load = no recovery capacity
// The leader is operating at structural maximum with no buffer
// Risk: sudden performance cliff, not gradual decline
// ───────────────────────────────────────────────
function detectRecoveryCycleCompression(scores: RiskScoreResult): StructuralSignal | null {
  const ld = scores.leadership_durability;
  const sr = scores.stress_regulation;
  const { lli_norm, risk_score, lsi } = scores;

  const hasLowDurability = ld < THRESHOLD.LD_DEPLETED;
  const hasLowStressReg  = sr < THRESHOLD.SR_LOW;
  const hasHighLoad      = lli_norm >= THRESHOLD.LLI_RECOVERY_RISK;

  // Need at least low durability + high load, or both signal domains weak
  if (!((hasLowDurability || hasLowStressReg) && hasHighLoad)) return null;

  const severity = Math.min(1,
    ((THRESHOLD.LD_DEPLETED - ld) / THRESHOLD.LD_DEPLETED +
     (lli_norm - THRESHOLD.LLI_RECOVERY_RISK) / (1 - THRESHOLD.LLI_RECOVERY_RISK)) / 2
  );

  const evidence: string[] = [];
  if (hasLowDurability) evidence.push(`Leadership Durability = ${ld.toFixed(1)} — reserve capacity is critically depleted`);
  if (hasLowStressReg)  evidence.push(`Stress Regulation = ${sr.toFixed(1)} — stress buffering is compromised`);
  evidence.push(`LLI_norm = ${lli_norm.toFixed(2)} — sustained high load with no recovery margin`);
  if (lsi < 3.5) evidence.push(`LSI = ${lsi.toFixed(2)} — broad signal weakness increases cliff-edge risk`);

  return {
    pattern: 'Recovery Cycle Compression',
    label: 'Recovery cycle compression',
    description: `Leadership durability at ${ld.toFixed(1)}/5 with ${(lli_norm * 100).toFixed(0)}% load — recovery reserve is exhausted. Performance cliff is probable.`,
    evidence,
    severity: Math.max(0.3, severity),
    urgency: severity > 0.6 ? 'Critical' : 'Active',
    confidence: hasLowDurability && hasHighLoad ? 'High' : 'Moderate',
    color: '#7C3AED',
    icon: 'battery-quarter',
  };
}

// ───────────────────────────────────────────────
// PATTERN D: EXECUTIVE DEPENDENCY PATTERN
// Org-level: when multiple leaders show high CEI
// The organization has built structural reliance on single nodes
// This pattern requires org-level data (array of leader scores)
// ───────────────────────────────────────────────
export function detectExecutiveDependency(
  leaderScores: Array<{ name: string; role_level: string; risk_score: number; cei: number; lli_norm: number; lsi: number }>
): StructuralSignal | null {
  if (leaderScores.length < 2) return null;

  const highCEI = leaderScores.filter(l => l.cei >= THRESHOLD.CEI_HIGH);
  const highRisk = leaderScores.filter(l => l.risk_score >= 0.10);
  const avgCEI = leaderScores.reduce((s, l) => s + l.cei, 0) / leaderScores.length;

  if (highCEI.length < 2 && avgCEI < 0.15) return null;

  const severity = Math.min(1, (highCEI.length / leaderScores.length) * 1.5);
  const isSystemic = highCEI.length >= Math.ceil(leaderScores.length * 0.4);

  const evidence: string[] = [
    `${highCEI.length} of ${leaderScores.length} leaders show CEI ≥ ${(THRESHOLD.CEI_HIGH * 100).toFixed(0)}%`,
    `Organization avg CEI = ${(avgCEI * 100).toFixed(1)}% — structural dependency is not isolated`,
  ];
  if (highRisk.length > 0) evidence.push(`${highRisk.length} leader(s) in Emerging Dependency or worse`);
  if (isSystemic) evidence.push('Pattern is systemic — architectural redesign required, not individual coaching');

  return {
    pattern: 'Executive Dependency Pattern',
    label: 'Executive dependency pattern',
    description: `${highCEI.length} leaders show concentrated decision routing — organizational architecture is creating structural dependency nodes.`,
    evidence,
    severity,
    urgency: isSystemic ? 'Acute' : 'Critical',
    confidence: highCEI.length >= 3 ? 'Very High' : 'High',
    color: '#DC2626',
    icon: 'sitemap',
  };
}

// ───────────────────────────────────────────────
// COMPOUND DETECTION
// When ≥2 patterns co-occur, risk amplification is non-linear
// ───────────────────────────────────────────────
function assessCompound(signals: StructuralSignal[]): StructuralSignal | null {
  if (signals.length < 2) return null;

  const combinedSeverity = Math.min(1,
    signals.reduce((s, sig) => s + sig.severity, 0) / signals.length * 1.4
  );

  const labels = signals.map(s => s.label).join(' + ');

  return {
    pattern: 'Compound Structural Failure',
    label: 'Compound structural failure',
    description: `${signals.length} structural failure patterns co-active: ${signals.map(s => s.pattern).join(', ')}. Risk amplification is non-linear.`,
    evidence: [
      `Active patterns: ${signals.map(s => s.pattern).join(', ')}`,
      'Co-occurrence increases escalation probability by 2–3× vs. single-pattern events',
      'Recovery timeline extends significantly under compound conditions',
    ],
    severity: combinedSeverity,
    urgency: 'Acute',
    confidence: 'Very High',
    color: '#7F1D1D',
    icon: 'radiation',
  };
}

// ───────────────────────────────────────────────
// PRESCRIPTION LIBRARY
// Mapped interventions per pattern, calibrated to severity
// ───────────────────────────────────────────────

const INTERVENTION_LIBRARY: Record<StructuralPattern, (scores: RiskScoreResult, severity: number) => Intervention> = {

  'Delegation Deficit': (scores, severity) => ({
    id: 'DDR',
    type: 'Decision Rights Redesign',
    title: 'Decision Rights Architecture™',
    rationale: `CEI of ${(scores.cei * 100).toFixed(0)}% indicates ${(scores.cei * 100).toFixed(0)}% of decisions route through this leader by default rather than design. A decision rights framework will redistribute authority to the structurally correct level.`,
    actions: [
      { week: 1, action: 'Map top 20 recurring decision categories by volume and complexity', metric: 'Decision inventory completed' },
      { week: 1, action: 'Identify 5–8 decisions currently resolved at this level that belong one tier down', metric: 'Delegation candidates documented' },
      { week: 2, action: 'Define RACI matrix for each category: who Recommends, Approves, Consults, Informs', metric: 'RACI draft reviewed with team' },
      { week: 2, action: 'Communicate new routing to direct reports — remove implicit escalation triggers', metric: 'Team briefing completed' },
      { week: 3, action: 'Pilot 3 decision categories under new routing for 2 weeks', metric: 'Pilot decisions resolved without escalation' },
      { week: 4, action: 'Review CEI delta — target reduction to < 15%', metric: 'CEI < 0.15 or trajectory confirmed' },
    ],
    time_to_escalation_days: severity > 0.7 ? 21 : severity > 0.4 ? 45 : 75,
    expected_risk_reduction: parseFloat((scores.risk_score * (0.35 + severity * 0.25)).toFixed(4)),
    expected_risk_pct: Math.round((0.35 + severity * 0.25) * 100),
    implementation_weeks: 4,
    effort: severity > 0.6 ? 'High' : 'Medium',
    owner: 'Leader + CHRO',
    priority: 1,
  }),

  'Decision Routing Overload': (scores, severity) => ({
    id: 'LRP',
    type: 'Load Redistribution Protocol',
    title: 'Load Redistribution Protocol™',
    rationale: `LLI_norm of ${scores.lli_norm.toFixed(2)} indicates decision processing load is exceeding sustainable capacity. Without redistribution, throughput will compress and organizational velocity will decline.`,
    actions: [
      { week: 1, action: 'Audit active decision queue — categorize by: must-resolve-self vs. can-delegate vs. can-defer', metric: 'Queue categories mapped' },
      { week: 1, action: 'Identify 2 direct reports with capacity to absorb delegated categories', metric: 'Absorption capacity confirmed' },
      { week: 2, action: 'Transfer minimum 3 decision categories within 10 days', metric: 'Transferred categories resolved without escalation' },
      { week: 2, action: 'Implement "office hours" model — batch non-urgent decision requests to 2× weekly slots', metric: 'Batching protocol active' },
      { week: 3, action: 'Block 20% of calendar from synchronous decisions — create async-first default', metric: 'Calendar restructured' },
      { week: 4, action: 'Measure LLI_norm delta — target < 0.60', metric: 'LLI_norm reduction confirmed at next assessment' },
    ],
    time_to_escalation_days: severity > 0.7 ? 14 : severity > 0.4 ? 30 : 60,
    expected_risk_reduction: parseFloat((scores.risk_score * (0.30 + severity * 0.20)).toFixed(4)),
    expected_risk_pct: Math.round((0.30 + severity * 0.20) * 100),
    implementation_weeks: 4,
    effort: 'Medium',
    owner: 'Leader',
    priority: severity > 0.7 ? 1 : 2,
  }),

  'Recovery Cycle Compression': (scores, severity) => ({
    id: 'CRP',
    type: 'Capacity Recovery Program',
    title: 'Capacity Recovery Program™',
    rationale: `Leadership Durability at ${scores.leadership_durability.toFixed(1)}/5 with ${(scores.lli_norm * 100).toFixed(0)}% load indicates the leader is operating with no recovery margin. Without structured recovery, a performance cliff is probable within 30–60 days.`,
    actions: [
      { week: 1, action: 'Immediate load audit — identify 20% of current commitments to defer or eliminate', metric: 'Load reduction plan approved' },
      { week: 1, action: 'Schedule two 90-min "recovery blocks" per week — non-negotiable, no meetings', metric: 'Recovery blocks on calendar' },
      { week: 2, action: 'Identify one direct report to act as decision buffer for 30 days — route low-complexity decisions through them first', metric: 'Buffer role active and handling decisions' },
      { week: 2, action: 'Review 60-day initiative load — defer at least 2 cross-functional projects', metric: 'Project load reduced' },
      { week: 3, action: 'Executive check-in with CHRO or coach — assess subjective recovery and capacity', metric: 'Check-in completed, findings documented' },
      { week: 4, action: 'Reassess Stress Regulation and Leadership Durability — confirm upward trajectory', metric: 'Domain scores improving' },
    ],
    time_to_escalation_days: severity > 0.6 ? 18 : 35,
    expected_risk_reduction: parseFloat((scores.risk_score * (0.25 + severity * 0.20)).toFixed(4)),
    expected_risk_pct: Math.round((0.25 + severity * 0.20) * 100),
    implementation_weeks: 6,
    effort: 'High',
    owner: 'CHRO + Leader',
    priority: severity > 0.6 ? 1 : 2,
  }),

  'Executive Dependency Pattern': (_scores, severity) => ({
    id: 'ETA',
    type: 'Executive Team Rebalancing',
    title: 'Executive Team Rebalancing Protocol™',
    rationale: 'Multiple leaders showing structural concentration indicates an organizational architecture problem — not a leadership capability problem. The decision routing infrastructure must be redesigned at the team level.',
    actions: [
      { week: 1, action: 'Map all org-level decision categories — identify which ones have no clear owner below C-suite', metric: 'Decision ownership gaps documented' },
      { week: 2, action: 'Conduct cross-functional decision routing workshop with all senior leaders', metric: 'Workshop completed, routing map produced' },
      { week: 2, action: 'Identify 3–5 positions or role expansions needed to absorb orphaned decision categories', metric: 'Structural gaps identified' },
      { week: 3, action: 'Initiate succession capability assessment — identify internal candidates for expanded authority', metric: 'Candidates assessed' },
      { week: 4, action: 'Redesign reporting structure to reduce single-point dependencies', metric: 'Org chart version 2 drafted' },
      { week: 6, action: 'Implement new reporting/routing structure and measure aggregate CEI delta', metric: 'Avg org CEI < 0.15' },
    ],
    time_to_escalation_days: severity > 0.6 ? 30 : 60,
    expected_risk_reduction: 0, // Org-level, not per-leader
    expected_risk_pct: Math.round(25 + severity * 20),
    implementation_weeks: 8,
    effort: 'High',
    owner: 'CEO + Board',
    priority: 1,
  }),

  'Compound Structural Failure': (scores, severity) => ({
    id: 'SRD',
    type: 'Structural Role Redesign',
    title: 'Structural Role Redesign™',
    rationale: `Multiple co-active failure patterns indicate the role itself has exceeded its structural design capacity. This is not addressable through behavioral coaching — the role scope, authority structure, and decision routing must be redesigned.`,
    actions: [
      { week: 1, action: 'Immediate load reduction: freeze all non-critical new commitments for 30 days', metric: 'Commitment freeze confirmed' },
      { week: 1, action: 'Emergency CHRO briefing — activate succession readiness review in parallel', metric: 'Briefing completed' },
      { week: 2, action: 'Commission structural audit: map all role accountabilities, decision authorities, and stakeholder dependencies', metric: 'Audit initiated' },
      { week: 3, action: 'Design role v2 — split or restructure accountabilities across 2+ roles where possible', metric: 'Role redesign options documented' },
      { week: 4, action: 'Implement immediate load relief: delegate minimum 30% of current decision volume', metric: 'Delegation confirmed and holding' },
      { week: 6, action: 'Reassess full risk profile — all four indices must show improvement', metric: 'Risk Score < 0.15, LLI_norm < 0.65' },
    ],
    time_to_escalation_days: 14,
    expected_risk_reduction: parseFloat((scores.risk_score * 0.50).toFixed(4)),
    expected_risk_pct: 50,
    implementation_weeks: 8,
    effort: 'High',
    owner: 'CEO + CHRO + Board',
    priority: 1,
  }),
};

// ───────────────────────────────────────────────
// PROJECTION ENGINE
// Models risk trajectory in 3 scenarios
// ───────────────────────────────────────────────

function buildProjections(
  scores: RiskScoreResult,
  primaryIntervention: Intervention | null,
  historicalScores: number[]
): RiskProjection[] {
  const r0 = scores.risk_score;

  // Drift rate: how fast does risk increase without action?
  // Based on trajectory + severity indicators
  const driftPerMonth = scores.lli_norm > 0.7 ? 0.025
    : scores.lli_norm > 0.55 ? 0.015
    : scores.lli_norm > 0.40 ? 0.008
    : 0.003;

  // With intervention: risk reduction starts at week 3–4 (actions have latency)
  const reduction = primaryIntervention?.expected_risk_reduction ?? r0 * 0.30;
  const reductionRate = reduction / 3; // spread over 3 monthly periods

  const noAction: RiskProjection = {
    scenario: 'No Action',
    day_0:  parseFloat(r0.toFixed(4)),
    day_30: parseFloat(Math.min(0.99, r0 + driftPerMonth).toFixed(4)),
    day_60: parseFloat(Math.min(0.99, r0 + driftPerMonth * 2.2).toFixed(4)),
    day_90: parseFloat(Math.min(0.99, r0 + driftPerMonth * 3.5).toFixed(4)),
    label: 'Trajectory without intervention',
    color: '#EF4444',
  };

  const withAction: RiskProjection = {
    scenario: 'With Intervention',
    day_0:  parseFloat(r0.toFixed(4)),
    day_30: parseFloat(Math.max(0.005, r0 - reductionRate * 0.4).toFixed(4)),  // partial in first month
    day_60: parseFloat(Math.max(0.005, r0 - reductionRate * 1.2).toFixed(4)),
    day_90: parseFloat(Math.max(0.005, r0 - reductionRate * 2.2).toFixed(4)),
    label: primaryIntervention ? `With ${primaryIntervention.type}` : 'With structured intervention',
    color: '#10B981',
  };

  return [noAction, withAction];
}

// ───────────────────────────────────────────────
// TIME TO ESCALATION
// Based on current risk level + drift rate
// ───────────────────────────────────────────────
function computeTimeToEscalation(
  scores: RiskScoreResult,
  signals: StructuralSignal[]
): number | null {
  if (!signals.length) return null;

  // Current cascade level → distance to next stage threshold
  const stageThresholds = [0.030, 0.080, 0.150, 0.300, Infinity];
  const currentLevel = scores.cascade_level; // 1–5
  if (currentLevel >= 5) return 7; // Already in worst stage

  const nextThreshold = stageThresholds[currentLevel]; // threshold for next level
  const gapToNext = nextThreshold - scores.risk_score;

  // Use primary signal's drift estimate
  const maxSeverity = Math.max(...signals.map(s => s.severity));
  const dailyDrift = maxSeverity * 0.0012 + (scores.lli_norm > 0.7 ? 0.0008 : 0.0003);

  if (dailyDrift <= 0) return null;
  return Math.round(gapToNext / dailyDrift);
}

// ───────────────────────────────────────────────
// ESCALATION PROBABILITY (90-day)
// ───────────────────────────────────────────────
function computeEscalationProbability(
  scores: RiskScoreResult,
  signals: StructuralSignal[],
  tteDays: number | null
): number {
  if (!signals.length) return 0.05;

  const baseProbability = Math.min(0.95,
    scores.risk_score * 1.5 +
    (scores.lli_norm > 0.7 ? 0.25 : 0) +
    (scores.cei > 0.20 ? 0.15 : 0) +
    (signals.length >= 2 ? 0.20 : 0)
  );

  // Adjust for time to escalation
  if (tteDays !== null && tteDays < 30) return Math.min(0.95, baseProbability + 0.25);
  if (tteDays !== null && tteDays < 60) return Math.min(0.90, baseProbability + 0.10);

  return parseFloat(baseProbability.toFixed(2));
}

// ───────────────────────────────────────────────
// COST OF INACTION
// Qualitative + quantitative framing for board/investor messaging
// ───────────────────────────────────────────────
function estimateCostOfInaction(
  scores: RiskScoreResult,
  tteDays: number | null,
  escalationProb: number
): string {
  const timeframe = tteDays !== null
    ? `within ${tteDays} days without intervention`
    : 'within 60–90 days if trajectory continues';

  if (scores.risk_score >= 0.20 || escalationProb > 0.70) {
    return `High probability of next cascade stage ${timeframe}. At Organizational Drag, decision throughput compression typically reduces team execution velocity by 25–40%. Replacement and transition costs for senior roles average 1.5–2× annual compensation.`;
  }
  if (scores.risk_score >= 0.10) {
    return `Emerging structural dependency will likely progress to Decision Bottleneck ${timeframe}. Organizations at this stage report 15–25% reduction in initiative delivery speed and elevated team turnover risk in direct reports.`;
  }
  return `Early structural patterns, if unaddressed, compound over 60–90 days. Prevention cost is 10–20× lower than structural redesign after full escalation.`;
}

// ───────────────────────────────────────────────
// SYSTEM RECOMMENDATION GENERATOR
// Concise executive-level directive
// ───────────────────────────────────────────────
function buildSystemRecommendation(
  signals: StructuralSignal[],
  primaryIntervention: Intervention | null,
  scores: RiskScoreResult,
  tteDays: number | null
): string {
  if (!signals.length || !primaryIntervention) {
    return 'No structural intervention required at this time. Continue quarterly monitoring.';
  }

  const urgency = signals[0].urgency;
  const days = tteDays !== null ? ` Risk escalation is modeled within ${tteDays} days without action.` : '';
  const reduction = primaryIntervention.expected_risk_pct;

  const directive: Record<UrgencyLevel, string> = {
    'Monitor':      `Maintain monitoring cadence. No immediate structural change required.`,
    'Preventative': `Initiate ${primaryIntervention.title} within 30 days. Expected ${reduction}% risk reduction.${days}`,
    'Active':       `Activate ${primaryIntervention.title} within 2 weeks. Expected ${reduction}% risk reduction.${days}`,
    'Critical':     `PRIORITY: Activate ${primaryIntervention.title} immediately. ${days} Delay materially increases escalation probability.`,
    'Acute':        `URGENT: Activate ${primaryIntervention.title} within 48 hours. Multiple structural failure patterns are co-active.${days} Board visibility recommended.`,
  };

  return directive[urgency] ?? directive['Active'];
}

// ═══════════════════════════════════════════════════════════════
// MASTER FUNCTION: computeInterventions()
// Single entry point for the full Structural Intervention Engine™
// ═══════════════════════════════════════════════════════════════

export function computeInterventions(
  scores: RiskScoreResult,
  historicalScores: number[] = [],
  orgLeaderScores?: Array<{ name: string; role_level: string; risk_score: number; cei: number; lli_norm: number; lsi: number }>
): InterventionReport {

  // ── Step 1: Detection
  const rawSignals: StructuralSignal[] = [];

  const delegationSignal = detectDelegationDeficit(scores);
  if (delegationSignal) rawSignals.push(delegationSignal);

  const overloadSignal = detectDecisionRoutingOverload(scores);
  if (overloadSignal) rawSignals.push(overloadSignal);

  const recoverySignal = detectRecoveryCycleCompression(scores);
  if (recoverySignal) rawSignals.push(recoverySignal);

  if (orgLeaderScores && orgLeaderScores.length >= 2) {
    const dependencySignal = detectExecutiveDependency(orgLeaderScores);
    if (dependencySignal) rawSignals.push(dependencySignal);
  }

  // Sort by severity DESC
  rawSignals.sort((a, b) => b.severity - a.severity);

  // Compound detection
  const isCompound = rawSignals.length >= 2;
  const compoundSignal = isCompound ? assessCompound(rawSignals) : null;

  const allSignals = compoundSignal
    ? [compoundSignal, ...rawSignals]
    : rawSignals;

  const primaryPattern = allSignals.length > 0 ? allSignals[0].pattern : null;

  // ── Step 2: Prescription
  const interventions: Intervention[] = rawSignals.map(signal => {
    const fn = INTERVENTION_LIBRARY[signal.pattern];
    return fn ? fn(scores, signal.severity) : null;
  }).filter(Boolean) as Intervention[];

  // If compound, add the compound intervention as top priority
  if (isCompound) {
    const compoundFn = INTERVENTION_LIBRARY['Compound Structural Failure'];
    const compoundIntervention = compoundFn(scores, compoundSignal!.severity);
    interventions.unshift(compoundIntervention);
  }

  // Sort interventions by priority
  interventions.sort((a, b) => a.priority - b.priority);
  const primaryIntervention = interventions[0] ?? null;

  // ── Step 3: Projection
  const projections = buildProjections(scores, primaryIntervention, historicalScores);

  // ── Step 4: Escalation metrics
  const tteDays = computeTimeToEscalation(scores, rawSignals);
  const escalationProb = computeEscalationProbability(scores, rawSignals, tteDays);
  const costOfInaction = estimateCostOfInaction(scores, tteDays, escalationProb);
  const recommendation = buildSystemRecommendation(rawSignals, primaryIntervention, scores, tteDays);

  return {
    signals: allSignals,
    primary_pattern: primaryPattern,
    is_compound: isCompound,
    interventions,
    primary_intervention: primaryIntervention,
    projections,
    time_to_next_cascade_days: tteDays,
    estimated_cost_of_inaction: costOfInaction,
    system_recommendation: recommendation,
    escalation_probability_90d: escalationProb,
  };
}

// ───────────────────────────────────────────────
// URGENCY META — for UI rendering
// ───────────────────────────────────────────────
export const URGENCY_META: Record<UrgencyLevel, { color: string; bg: string; borderColor: string; icon: string; label: string }> = {
  'Monitor':      { color: '#10B981', bg: '#ECFDF5', borderColor: '#6EE7B7', icon: 'eye',              label: 'Monitor' },
  'Preventative': { color: '#84CC16', bg: '#F7FEE7', borderColor: '#A3E635', icon: 'shield-alt',       label: 'Preventative' },
  'Active':       { color: '#F59E0B', bg: '#FFFBEB', borderColor: '#FCD34D', icon: 'exclamation',      label: 'Active' },
  'Critical':     { color: '#F97316', bg: '#FFF7ED', borderColor: '#FB923C', icon: 'exclamation-circle', label: 'Critical' },
  'Acute':        { color: '#EF4444', bg: '#FEF2F2', borderColor: '#F87171', icon: 'radiation',        label: 'Acute' },
};

export const CONFIDENCE_META: Record<ConfidenceLevel, { color: string; label: string }> = {
  'Low':      { color: '#94A3B8', label: 'Low confidence' },
  'Moderate': { color: '#F59E0B', label: 'Moderate confidence' },
  'High':     { color: '#10B981', label: 'High confidence' },
  'Very High':{ color: '#6366F1', label: 'Very high confidence' },
};
