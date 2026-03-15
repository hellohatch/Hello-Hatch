// Leadership Risk Intelligence™ — Core Types (v3.2 — Structural Intervention Engine™)

export type CascadeStage =
  | 'Healthy Distribution'
  | 'Emerging Exposure'
  | 'Structural Dependency'
  | 'Decision Bottleneck'
  | 'Organizational Drag';

export type SignalPattern =
  | 'Organizational Stabilizer'
  | 'Strategic Interpreter'
  | 'Structural Bottleneck Risk'
  | 'Leadership Load Saturation';

export type RiskLevel =
  | 'Low structural risk'
  | 'Early exposure'
  | 'Emerging dependency'
  | 'Structural bottleneck'
  | 'Organizational risk';

export type TrajectoryDirection = 'Improving' | 'Stable' | 'Declining';

export type SignalDomain =
  | 'stress_regulation'
  | 'cognitive_breadth'
  | 'trust_climate'
  | 'ethical_integrity'
  | 'leadership_durability'
  | 'adaptive_capacity';

export interface DomainMeta {
  key: SignalDomain;
  label: string;
  shortLabel: string;
  color: string;
  description: string;
  questions: string[];
}

export interface Question {
  id: string;
  domain: SignalDomain | 'load' | 'orientation';
  text: string;
  scored: boolean;
  reverse?: boolean;
}

export interface RiskScoreResult {
  // Domain scores (1.0–5.0)
  stress_regulation: number;
  cognitive_breadth: number;
  trust_climate: number;
  ethical_integrity: number;
  leadership_durability: number;
  adaptive_capacity: number;
  // LSI
  lsi: number;
  lsi_norm: number;        // NEW v3.1: LSI / 5 → range 0.0–1.0
  domain_variance: number;
  signal_pattern: SignalPattern;
  // Load
  lli_raw: number;
  lli_norm: number;
  // Exposure
  cei: number;
  cascade_stage: CascadeStage;
  cascade_level: number;
  // Risk  (v3.1: uses LSI_norm denominator)
  risk_score: number;
  risk_level: RiskLevel;
  trajectory_direction: TrajectoryDirection;
}

export interface LeaderRow {
  leader_id: number;
  organization_id: number;
  name: string;
  email: string;
  title: string;
  role_level: string;
  system_role: string;
  created_at: string;
}

export interface OrgRow {
  organization_id: number;
  name: string;
  industry: string;
  employee_count: number;
}

export type Bindings = {
  DB: D1Database;
};

export type Variables = {
  leaderId: number;
  orgId: number;
  leaderRole: string;
  leaderName: string;
};
