// Leadership Signal Index™ — Core Types

export type OrgStage = 'early_vc' | 'growth_vc' | 'enterprise';
export type RiskTier = 'Green' | 'Yellow' | 'Orange' | 'Red';
export type InterventionType = 'preventative' | 'corrective' | 'urgent';
export type Band = 'Exceptional' | 'Strong' | 'Adequate' | 'Developing' | 'At-Risk' | 'Critical';
export type Domain = 'operational' | 'cognitive' | 'ethical' | 'trust' | 'adaptive' | 'durability';

export interface Organization {
  id: number;
  name: string;
  type: OrgStage | 'enterprise';
  created_at: string;
}

export interface User {
  id: number;
  org_id: number;
  email: string;
  name: string;
  role: 'admin' | 'leader';
  role_level: string;
  created_at: string;
}

export interface ContextModule {
  role_level: string;
  org_stage: OrgStage;
  team_size: number;
  decision_volume: 'low' | 'moderate' | 'high' | 'very_high';
  change_intensity: 'low' | 'moderate' | 'high' | 'very_high';
  escalation_frequency: string;
}

export interface Assessment {
  id: number;
  leader_id: number;
  org_id: number;
  status: 'in_progress' | 'completed' | 'flagged';
  context: ContextModule;
  integrity_passed: boolean;
  consistency_index: number;
  started_at: string;
  completed_at?: string;
}

export interface AssessmentQuestion {
  id: string;
  domain: Domain;
  text: string;
  weight: number;
  is_anchor: boolean;
  is_reverse: boolean;
  time_horizon?: string; // e.g., "last 30-45 days"
}

export interface IndexScore {
  score: number;           // 0-100
  band: Band;
  confidence: number;      // 0-1
  reason_codes: string[];
}

export interface SignalScores {
  assessment_id: number;
  leader_id: number;
  operational_stability: IndexScore;
  cognitive_breadth: IndexScore;
  ethical_integrity: IndexScore;
  trust_climate: IndexScore;
  adaptive_capacity: IndexScore;
  leadership_durability: IndexScore;
  lsi_composite: number;
  convergence_flag: boolean;
  concentration_signature: boolean;
  drift_acceleration: boolean;
  protective_buffer: boolean;
  risk_tier: RiskTier;
  tier_label: string;
  intervention_type: InterventionType;
  intervention_plan: InterventionPlan;
  created_at: string;
}

export interface InterventionPlan {
  type: InterventionType;
  title: string;
  description: string;
  self_guided: string[];
  facilitated: string[];
  advisory_option: string;
  urgency_note?: string;
}

export interface TierDefinition {
  tier: RiskTier;
  label: string;
  range: [number, number];
  color: string;
  description: string;
  bg: string;
  text: string;
}

export type Bindings = {
  DB: D1Database;
};

export type Variables = {
  userId: number;
  orgId: number;
  userRole: string;
  userName: string;
};
