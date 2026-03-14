// Leadership Risk Intelligence™ — Scoring Engine v3.0
// Implements exact formulas from Engineering Architecture Specification v3.0

import type {
  SignalDomain, SignalPattern, CascadeStage, RiskLevel,
  TrajectoryDirection, RiskScoreResult,
} from '../types/index.js';
import { QUESTIONS, DOMAIN_META, DOMAIN_KEYS } from './questions.js';

// ─────────────────────────────────────────────────────────────
// MODEL 1: LEADERSHIP SIGNAL INDEX™
// Domain Score = Sum(domain responses) / 5   → range 1.0–5.0
// LSI = (SR + CB + TC + EI + LD + AC) / 6   → range 1.0–5.0
// ─────────────────────────────────────────────────────────────

export function computeDomainScore(
  domain: SignalDomain,
  responses: Map<string, number>
): number {
  const domainQs = QUESTIONS.filter(q => q.domain === domain && q.scored);
  if (domainQs.length === 0) return 0;

  let sum = 0;
  for (const q of domainQs) {
    const raw = responses.get(q.id) ?? 3; // default neutral
    // Reverse-scored items: 6 - value  (so 5→1, 4→2, 3→3, 2→4, 1→5)
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

// ─────────────────────────────────────────────────────────────
// DOMAIN VARIANCE — for Signal Pattern classification
// variance = stddev(domain_scores)
// ─────────────────────────────────────────────────────────────
export function computeDomainVariance(domainScores: Record<SignalDomain, number>): number {
  const values = DOMAIN_KEYS.map(k => domainScores[k]);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return parseFloat(Math.sqrt(variance).toFixed(3)); // returning stddev
}

// ─────────────────────────────────────────────────────────────
// MODEL 2: LEADERSHIP LOAD INDEX™
// LLI_raw  = Sum(load_responses) / 5        → range 1.0–5.0
// LLI_norm = (LLI_raw - 1) / 4             → range 0.0–1.0
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
  if (totalDecisions === 0) return 0.35; // default to Emerging Exposure if unknown
  return parseFloat((leaderDecisions / totalDecisions).toFixed(3));
}

// ─────────────────────────────────────────────────────────────
// MODEL 4: LEADERSHIP COST CASCADE™
// Stage determined by CEI thresholds
// ─────────────────────────────────────────────────────────────
export const CASCADE_STAGES: Array<{
  level: number;
  stage: CascadeStage;
  range: [number, number];
  color: string;
  bg: string;
  textColor: string;
  description: string;
}> = [
  {
    level: 1,
    stage: 'Healthy Distribution',
    range: [0.00, 0.30],
    color: '#10B981',
    bg: '#ECFDF5',
    textColor: '#065F46',
    description: 'Decision load is well distributed. Leadership capacity is not structurally constrained.',
  },
  {
    level: 2,
    stage: 'Emerging Exposure',
    range: [0.31, 0.45],
    color: '#84CC16',
    bg: '#F7FEE7',
    textColor: '#365314',
    description: 'Early concentration signals appearing. Preventative attention is warranted.',
  },
  {
    level: 3,
    stage: 'Structural Dependency',
    range: [0.46, 0.65],
    color: '#F59E0B',
    bg: '#FFFBEB',
    textColor: '#78350F',
    description: 'Organization is structurally dependent on this leader for decision resolution.',
  },
  {
    level: 4,
    stage: 'Decision Bottleneck',
    range: [0.66, 0.80],
    color: '#F97316',
    bg: '#FFF7ED',
    textColor: '#7C2D12',
    description: 'Decision throughput is critically constrained. Organizational velocity is compromised.',
  },
  {
    level: 5,
    stage: 'Organizational Drag',
    range: [0.81, 1.00],
    color: '#EF4444',
    bg: '#FEF2F2',
    textColor: '#7F1D1D',
    description: 'Decision concentration is creating measurable organizational drag and systemic risk.',
  },
];

export function computeCascadeStage(cei: number): {
  stage: CascadeStage;
  level: number;
  stageMeta: typeof CASCADE_STAGES[0];
} {
  const stageMeta = CASCADE_STAGES.find(
    s => cei >= s.range[0] && cei <= s.range[1]
  ) ?? CASCADE_STAGES[CASCADE_STAGES.length - 1];
  return { stage: stageMeta.stage, level: stageMeta.level, stageMeta };
}

// ─────────────────────────────────────────────────────────────
// LEADERSHIP RISK SCORE™
// Risk Score = (CEI × LLI_norm) / LSI
// ─────────────────────────────────────────────────────────────
export function computeRiskScore(lsi: number, lli_norm: number, cei: number): number {
  if (lsi === 0) return 0;
  return parseFloat(((cei * lli_norm) / lsi).toFixed(4));
}

export const RISK_LEVELS: Array<{
  level: RiskLevel;
  range: [number, number];
  color: string;
  bg: string;
  textColor: string;
}> = [
  { level: 'Low structural risk',    range: [0,     0.050], color: '#10B981', bg: '#ECFDF5', textColor: '#065F46' },
  { level: 'Early exposure',         range: [0.051, 0.100], color: '#84CC16', bg: '#F7FEE7', textColor: '#365314' },
  { level: 'Emerging dependency',    range: [0.101, 0.200], color: '#F59E0B', bg: '#FFFBEB', textColor: '#78350F' },
  { level: 'Structural bottleneck',  range: [0.201, 0.350], color: '#F97316', bg: '#FFF7ED', textColor: '#7C2D12' },
  { level: 'Organizational risk',    range: [0.351, 999],   color: '#EF4444', bg: '#FEF2F2', textColor: '#7F1D1D' },
];

export function classifyRiskLevel(riskScore: number): RiskLevel {
  const match = RISK_LEVELS.find(r => riskScore >= r.range[0] && riskScore <= r.range[1]);
  return match?.level ?? 'Organizational risk';
}

export function getRiskLevelMeta(riskScore: number) {
  return RISK_LEVELS.find(r => riskScore >= r.range[0] && riskScore <= r.range[1]) ?? RISK_LEVELS[RISK_LEVELS.length - 1];
}

// ─────────────────────────────────────────────────────────────
// SIGNAL PATTERN CLASSIFICATION
// Based on LSI, domain variance, LLI, CEI
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

  // Priority order matters
  if (lli_norm >= 0.55 && ld < 3.0) return 'Leadership Load Saturation';
  if (lli_norm >= 0.5  && cei >= 0.46) return 'Structural Bottleneck Risk';
  if (lsi >= 3.8 && domainVariance < 0.5) return 'Organizational Stabilizer';
  if (cb >= 3.8 && ei >= 3.8) return 'Strategic Interpreter';
  // Default to the most concerning pattern if none match well
  if (lli_norm >= 0.5) return 'Structural Bottleneck Risk';
  return 'Organizational Stabilizer';
}

// ─────────────────────────────────────────────────────────────
// TRAJECTORY DIRECTION
// Compares current risk score to historical average
// ─────────────────────────────────────────────────────────────
export function computeTrajectory(
  currentRiskScore: number,
  historicalScores: number[]
): TrajectoryDirection {
  if (historicalScores.length === 0) return 'Stable';
  const avgHistorical = historicalScores.reduce((a, b) => a + b, 0) / historicalScores.length;
  const delta = currentRiskScore - avgHistorical;
  if (delta < -0.01) return 'Improving';
  if (delta > 0.01)  return 'Declining';
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

  // 2. LSI
  const lsi = computeLSI(domainScores);
  const domain_variance = computeDomainVariance(domainScores);

  // 3. LLI
  const { lli_raw, lli_norm } = computeLLI(responses);

  // 4. CEI
  const cei = computeCEI(ceiLeaderDecisions, ceiTotalDecisions);

  // 5. Cascade stage
  const { stage: cascade_stage, level: cascade_level } = computeCascadeStage(cei);

  // 6. Risk score
  const risk_score = computeRiskScore(lsi, lli_norm, cei);
  const risk_level = classifyRiskLevel(risk_score);

  // 7. Signal pattern
  const signal_pattern = classifySignalPattern(domainScores, lsi, domain_variance, lli_norm, cei);

  // 8. Trajectory
  const trajectory_direction = computeTrajectory(risk_score, historicalRiskScores);

  return {
    ...domainScores,
    lsi,
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
