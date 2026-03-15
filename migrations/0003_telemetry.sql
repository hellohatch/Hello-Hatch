-- Migration 0003: Structural Telemetry Layer™ v1.0
-- Adds telemetry ingestion, signal normalization, and fusion results tables
-- ─────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────
-- TABLE: telemetry_snapshots
-- Stores one raw telemetry snapshot per leader per period
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telemetry_snapshots (
  snapshot_id         INTEGER PRIMARY KEY AUTOINCREMENT,
  leader_id           INTEGER NOT NULL,
  organization_id     INTEGER NOT NULL,

  -- Data provenance
  source_system       TEXT,            -- e.g. 'calendar', 'ticketing', 'manual_upload', 'api'
  period_start        DATE,            -- Start of measurement window
  period_end          DATE,            -- End of measurement window
  period_weeks        INTEGER DEFAULT 4,
  data_completeness_pct REAL DEFAULT 100,

  -- ── OPERATIONAL LOAD SIGNALS ──
  meeting_hours_per_week        REAL,
  decision_approvals_per_week   REAL,
  cross_functional_meetings_pct REAL,
  recurring_meeting_hours_pct   REAL,
  calendar_fragmentation_score  REAL,

  -- ── DECISION ROUTING SIGNALS ──
  approvals_requiring_this_leader_pct REAL,
  escalation_frequency_per_week       REAL,
  decision_routing_dependencies       REAL,
  cross_func_approval_concentration   REAL,

  -- ── STRUCTURAL DEPENDENCY SIGNALS ──
  active_projects_owned         REAL,
  functions_dependent_count     REAL,
  routing_dependency_breadth    REAL,
  single_point_of_failure_score REAL,

  -- ── RECOVERY COMPRESSION SIGNALS ──
  weeks_sustained_overload         REAL,
  calendar_whitespace_pct          REAL,
  after_hours_meetings_pct         REAL,
  weekend_activity_days_per_month  REAL,

  -- ── COMPUTED INDEXES (stored after normalization) ──
  tli                  REAL,    -- Telemetry Load Index™
  tci                  REAL,    -- Telemetry Concentration Index™
  rpi                  REAL,    -- Recovery Pressure Index™
  telemetry_composite  REAL,    -- Overall telemetry risk composite
  data_confidence      REAL,    -- Signal reliability 0–1

  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (leader_id)       REFERENCES leaders(leader_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_leader   ON telemetry_snapshots(leader_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_org      ON telemetry_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_created  ON telemetry_snapshots(created_at);

-- ─────────────────────────────────────────────────────────────────────────
-- TABLE: fusion_results
-- Stores the Intelligence Fusion Engine™ output linking assessment + telemetry
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fusion_results (
  fusion_id            INTEGER PRIMARY KEY AUTOINCREMENT,
  leader_id            INTEGER NOT NULL,
  organization_id      INTEGER NOT NULL,
  assessment_id        INTEGER,          -- FK to assessments table
  snapshot_id          INTEGER,          -- FK to telemetry_snapshots

  -- Operational mode
  operational_mode     TEXT NOT NULL,    -- 'Assessment' | 'Calibrated' | 'Full Intelligence'
  telemetry_confidence REAL,

  -- Assessment-only scores (baseline)
  assessment_lli_norm  REAL,
  assessment_cei       REAL,
  assessment_lsi_norm  REAL,
  assessment_risk_score REAL,
  assessment_risk_level TEXT,

  -- Calibrated scores (fusion output)
  calibrated_lli_norm  REAL,
  calibrated_cei       REAL,
  calibrated_risk_score REAL,
  calibrated_risk_level TEXT,
  calibrated_cascade_stage TEXT,
  calibrated_cascade_level INTEGER,
  calibrated_rpi       REAL,

  -- Divergence
  divergence_pattern   TEXT,            -- 'Confirmed Overload' | 'Hidden Dependency' etc.
  divergence_severity  TEXT,            -- 'Critical' | 'High' | 'Moderate' | 'Low' | 'None'
  lli_divergence       REAL,
  cei_divergence       REAL,
  divergence_magnitude REAL,

  -- Confidence
  confidence_overall   REAL,
  confidence_label     TEXT,

  -- Narrative
  fusion_insight       TEXT,

  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (leader_id)       REFERENCES leaders(leader_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id),
  FOREIGN KEY (assessment_id)   REFERENCES assessments(assessment_id),
  FOREIGN KEY (snapshot_id)     REFERENCES telemetry_snapshots(snapshot_id)
);

CREATE INDEX IF NOT EXISTS idx_fusion_leader      ON fusion_results(leader_id);
CREATE INDEX IF NOT EXISTS idx_fusion_org         ON fusion_results(organization_id);
CREATE INDEX IF NOT EXISTS idx_fusion_assessment  ON fusion_results(assessment_id);
CREATE INDEX IF NOT EXISTS idx_fusion_created     ON fusion_results(created_at);

-- ─────────────────────────────────────────────────────────────────────────
-- TABLE: telemetry_source_configs
-- Stores organization-level telemetry connector configuration
-- (what data sources are connected, their status, and sync metadata)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telemetry_source_configs (
  config_id            INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id      INTEGER NOT NULL,
  source_type          TEXT NOT NULL,   -- 'calendar' | 'ticketing' | 'hr_system' | 'collaboration' | 'manual'
  source_label         TEXT,            -- Human-readable name e.g. 'Google Workspace Calendar'
  is_active            INTEGER DEFAULT 0,  -- 0 = inactive, 1 = active
  last_sync_at         DATETIME,
  sync_frequency_days  INTEGER DEFAULT 7,
  notes                TEXT,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)
);

CREATE INDEX IF NOT EXISTS idx_tsc_org ON telemetry_source_configs(organization_id);
