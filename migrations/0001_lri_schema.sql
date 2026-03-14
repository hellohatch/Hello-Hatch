-- Leadership Risk Intelligence™ Platform — v3.0 Schema
-- Hatch | March 2026

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  organization_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT NOT NULL,
  industry          TEXT,
  employee_count    INTEGER,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Leaders
CREATE TABLE IF NOT EXISTS leaders (
  leader_id         INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id   INTEGER NOT NULL,
  name              TEXT NOT NULL,
  email             TEXT UNIQUE NOT NULL,
  title             TEXT,
  department        TEXT,
  role_level        TEXT,
  manager_id        INTEGER,
  password_hash     TEXT NOT NULL,
  system_role       TEXT NOT NULL DEFAULT 'leader',  -- 'admin' | 'leader'
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id),
  FOREIGN KEY (manager_id)      REFERENCES leaders(leader_id)
);

-- Assessments
CREATE TABLE IF NOT EXISTS assessments (
  assessment_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  leader_id         INTEGER NOT NULL,
  assessment_version TEXT NOT NULL DEFAULT 'v3.0',
  status            TEXT NOT NULL DEFAULT 'in_progress',  -- 'in_progress' | 'completed'
  future_orientation TEXT,   -- the unscored Q36 free-text answer
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at      DATETIME,
  FOREIGN KEY (leader_id) REFERENCES leaders(leader_id)
);

-- Assessment Responses (Q1–Q35, value 1–5)
CREATE TABLE IF NOT EXISTS assessment_responses (
  response_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id     INTEGER NOT NULL,
  question_id       TEXT NOT NULL,
  response_value    INTEGER NOT NULL CHECK(response_value BETWEEN 1 AND 5),
  FOREIGN KEY (assessment_id) REFERENCES assessments(assessment_id)
);

-- Decision Events (for CEI calculation)
CREATE TABLE IF NOT EXISTS decision_events (
  decision_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  leader_id         INTEGER NOT NULL,
  organization_id   INTEGER NOT NULL,
  initiated_by      INTEGER,
  resolved_by       INTEGER,
  complexity_score  REAL,
  decision_type     TEXT,
  timestamp         DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (leader_id)       REFERENCES leaders(leader_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)
);

-- Strategic Initiatives
CREATE TABLE IF NOT EXISTS strategic_initiatives (
  initiative_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  leader_id         INTEGER NOT NULL,
  cross_functional  INTEGER DEFAULT 0,
  team_count        INTEGER DEFAULT 1,
  priority_level    TEXT DEFAULT 'medium',
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (leader_id) REFERENCES leaders(leader_id)
);

-- Computed Risk Scores (one row per assessment)
CREATE TABLE IF NOT EXISTS risk_scores (
  score_id          INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id     INTEGER NOT NULL,
  leader_id         INTEGER NOT NULL,
  organization_id   INTEGER NOT NULL,
  -- Domain scores (1.0 – 5.0)
  stress_regulation     REAL,
  cognitive_breadth     REAL,
  trust_climate         REAL,
  ethical_integrity     REAL,
  leadership_durability REAL,
  adaptive_capacity     REAL,
  -- LSI (1.0 – 5.0) and LSI_norm (0.0 – 1.0)
  lsi                   REAL,
  lsi_norm              REAL,   -- v3.1: LSI / 5  →  0.0–1.0 (formula alignment)
  domain_variance       REAL,
  signal_pattern        TEXT,   -- 'Organizational Stabilizer' | 'Strategic Interpreter' | 'Structural Bottleneck Risk' | 'Leadership Load Saturation'
  -- Load (raw 1–5, normalized 0–1)
  lli_raw               REAL,
  lli_norm              REAL,
  -- CEI (0–1) — can be entered manually or auto-computed
  cei                   REAL,
  cei_total_decisions   INTEGER,
  cei_leader_decisions  INTEGER,
  -- Decision Velocity (decisions/day)
  decision_velocity     REAL,   -- v3.1: total_decisions / days_elapsed
  velocity_drag         REAL,   -- v3.1: (baseline_velocity - current_velocity) / baseline_velocity
  cascade_stage         TEXT,   -- v3.1: classified by Risk Score (not CEI alone)
  cascade_level         INTEGER, -- 1–5
  -- Final Risk Score  (v3.1: (CEI × LLI_norm) / LSI_norm)
  risk_score            REAL,
  risk_level            TEXT,   -- 'Low structural risk' | 'Early exposure' | 'Emerging dependency' | 'Structural bottleneck' | 'Organizational risk'
  -- Trajectory (simple projection)
  trajectory_direction  TEXT,   -- 'Improving' | 'Stable' | 'Declining'
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assessment_id)   REFERENCES assessments(assessment_id),
  FOREIGN KEY (leader_id)       REFERENCES leaders(leader_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leaders_org   ON leaders(organization_id);
CREATE INDEX IF NOT EXISTS idx_leaders_email ON leaders(email);
CREATE INDEX IF NOT EXISTS idx_assessments_leader ON assessments(leader_id);
CREATE INDEX IF NOT EXISTS idx_responses_assessment ON assessment_responses(assessment_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_leader ON risk_scores(leader_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_org    ON risk_scores(organization_id);
CREATE INDEX IF NOT EXISTS idx_decisions_leader   ON decision_events(leader_id);
CREATE INDEX IF NOT EXISTS idx_decisions_org      ON decision_events(organization_id);
