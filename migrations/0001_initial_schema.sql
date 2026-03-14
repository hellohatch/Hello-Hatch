-- Leadership Signal Index™ — Database Schema

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'enterprise', -- 'enterprise' | 'vc_portfolio' | 'growth' | 'early_vc'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Users / Leaders table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'leader', -- 'admin' | 'leader'
  role_level TEXT, -- 'C-Suite' | 'VP' | 'Director' | 'Manager'
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (org_id) REFERENCES organizations(id)
);

-- Assessment Sessions
CREATE TABLE IF NOT EXISTS assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  leader_id INTEGER NOT NULL,
  org_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress' | 'completed' | 'flagged'
  -- Context module
  role_level TEXT,
  org_stage TEXT, -- 'early_vc' | 'growth_vc' | 'enterprise'
  team_size INTEGER,
  decision_volume TEXT, -- 'low' | 'moderate' | 'high' | 'very_high'
  change_intensity TEXT, -- 'low' | 'moderate' | 'high' | 'very_high'
  escalation_frequency TEXT,
  -- Integrity flags
  consistency_index REAL,
  extreme_responding INTEGER DEFAULT 0,
  pattern_contradiction INTEGER DEFAULT 0,
  low_effort_flag INTEGER DEFAULT 0,
  integrity_passed INTEGER DEFAULT 1,
  -- Timestamps
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (leader_id) REFERENCES users(id),
  FOREIGN KEY (org_id) REFERENCES organizations(id)
);

-- Individual question responses
CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id INTEGER NOT NULL,
  question_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  response_value INTEGER NOT NULL, -- 1-7 Likert scale
  is_anchor INTEGER DEFAULT 0,
  is_reverse INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assessment_id) REFERENCES assessments(id)
);

-- Computed signal scores per assessment
CREATE TABLE IF NOT EXISTS signal_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id INTEGER NOT NULL,
  leader_id INTEGER NOT NULL,
  org_id INTEGER NOT NULL,
  -- The 6 LSI Indices (0-100)
  operational_stability REAL,
  cognitive_breadth REAL,
  ethical_integrity REAL,
  trust_climate REAL,
  adaptive_capacity REAL,
  leadership_durability REAL,
  -- Confidence scores per index (0-1)
  confidence_operational REAL,
  confidence_cognitive REAL,
  confidence_ethical REAL,
  confidence_trust REAL,
  confidence_adaptive REAL,
  confidence_durability REAL,
  -- Composite
  lsi_composite REAL,
  -- Convergence & Tier
  convergence_flag INTEGER DEFAULT 0,
  concentration_signature INTEGER DEFAULT 0,
  drift_acceleration INTEGER DEFAULT 0,
  protective_buffer INTEGER DEFAULT 0,
  risk_tier TEXT, -- 'Green' | 'Yellow' | 'Orange' | 'Red'
  tier_label TEXT,
  -- Intervention windows
  intervention_type TEXT, -- 'preventative' | 'corrective' | 'urgent'
  intervention_plan TEXT, -- JSON blob
  -- Band classifications
  operational_band TEXT,
  cognitive_band TEXT,
  ethical_band TEXT,
  trust_band TEXT,
  adaptive_band TEXT,
  durability_band TEXT,
  -- Reason codes (JSON)
  reason_codes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assessment_id) REFERENCES assessments(id),
  FOREIGN KEY (leader_id) REFERENCES users(id),
  FOREIGN KEY (org_id) REFERENCES organizations(id)
);

-- Benchmark aggregates (anonymized, org-level)
CREATE TABLE IF NOT EXISTS benchmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  period TEXT NOT NULL, -- e.g. '2025-Q1'
  sample_size INTEGER,
  avg_operational REAL,
  avg_cognitive REAL,
  avg_ethical REAL,
  avg_trust REAL,
  avg_adaptive REAL,
  avg_durability REAL,
  avg_composite REAL,
  pct_green INTEGER,
  pct_yellow INTEGER,
  pct_orange INTEGER,
  pct_red INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (org_id) REFERENCES organizations(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assessments_leader ON assessments(leader_id);
CREATE INDEX IF NOT EXISTS idx_assessments_org ON assessments(org_id);
CREATE INDEX IF NOT EXISTS idx_responses_assessment ON responses(assessment_id);
CREATE INDEX IF NOT EXISTS idx_signal_scores_leader ON signal_scores(leader_id);
CREATE INDEX IF NOT EXISTS idx_signal_scores_org ON signal_scores(org_id);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
