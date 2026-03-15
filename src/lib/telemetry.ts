// ═══════════════════════════════════════════════════════════════════════
// Structural Telemetry Layer™  v1.0
// Leadership Risk Intelligence™ Platform — Hatch
//
// PURPOSE:
//   Ingests operational metadata from enterprise systems to provide
//   objective structural calibration of leadership demand, decision
//   routing concentration, and recovery bandwidth compression.
//
// THREE TELEMETRY INDEXES:
//   TLI  — Telemetry Load Index™       (operational demand)
//   TCI  — Telemetry Concentration Index™ (decision/routing concentration)
//   RPI  — Recovery Pressure Index™    (recovery compression)
//
// FOUR SIGNAL DOMAINS:
//   Operational Load    → meeting hours, decision frequency, coordination volume
//   Decision Routing    → approval concentration, escalation frequency
//   Structural Dependency → project/function concentration, routing breadth
//   Recovery Compression → sustained load, whitespace reduction, after-hours
//
// All signals normalized 0.0–1.0 for formula alignment with the
// perception-based LLI_norm and CEI constructs.
// ═══════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────
// RAW TELEMETRY INPUT SHAPE
// Enterprise systems provide these raw metrics per leader per period
// ───────────────────────────────────────────────

export interface RawTelemetryInput {
  // ── Operational Load Signals ──
  meeting_hours_per_week:        number;   // Total meeting hours/week (typical range: 0–50)
  decision_approvals_per_week:   number;   // Count of approval requests per week (0–100)
  cross_functional_meetings_pct: number;   // % of meetings cross-functional (0–100)
  recurring_meeting_hours_pct:   number;   // % of meeting hours that are recurring (0–100)
  calendar_fragmentation_score:  number;   // 0–100: % of day in <30min blocks (proxy for interruption)

  // ── Decision Routing Signals ──
  approvals_requiring_this_leader_pct: number; // % of org decisions requiring this leader (0–100)
  escalation_frequency_per_week:       number; // Escalations received per week (0–50)
  decision_routing_dependencies:       number; // Count of distinct functions routing to this leader (0–20)
  cross_func_approval_concentration:   number; // % of cross-functional approvals concentrated here (0–100)

  // ── Structural Dependency Signals ──
  active_projects_owned:           number; // Projects this leader is primary owner of (0–50)
  functions_dependent_count:       number; // # of org functions dependent on this node (0–15)
  routing_dependency_breadth:      number; // # of distinct teams routing through this leader (0–20)
  single_point_of_failure_score:   number; // Subjective/system flag 0–100 (from org mapping tools)

  // ── Recovery Compression Signals ──
  weeks_sustained_overload:        number; // Consecutive weeks above 45h effective work (0–52)
  calendar_whitespace_pct:         number; // % of calendar that is unscheduled (0–100; inverse metric)
  after_hours_meetings_pct:        number; // % of meetings outside 09:00–18:00 (0–100)
  weekend_activity_days_per_month: number; // Days with weekend meeting/approval activity (0–8)

  // ── Metadata ──
  period_weeks:    number;   // Number of weeks this data covers (1–52)
  data_completeness_pct: number; // % of fields with real data vs. default/estimated (0–100)
}

// ───────────────────────────────────────────────
// NORMALIZED SIGNAL VECTORS  (all 0.0–1.0)
// ───────────────────────────────────────────────

export interface TelemetrySignalVector {
  // Operational Load
  meeting_load:           number;  // hours/week → normalized
  approval_demand:        number;  // approvals/week → normalized
  coordination_volume:    number;  // cross-functional meeting % → normalized
  recurring_burden:       number;  // recurring meeting % → normalized
  calendar_fragmentation: number;  // fragmentation score → normalized

  // Decision Routing
  approval_concentration:       number;  // % decisions requiring this leader
  escalation_rate:              number;  // escalations/week → normalized
  routing_dependency_count:     number;  // distinct functions routing → normalized
  cross_func_concentration:     number;  // % cross-func approvals concentrated

  // Structural Dependency
  project_concentration:    number;  // active projects owned → normalized
  function_dependency:      number;  // functions dependent → normalized
  routing_breadth:          number;  // distinct teams routing → normalized
  failure_point_risk:       number;  // SPOF score → normalized

  // Recovery Compression
  sustained_overload:         number;  // weeks consecutive overload → normalized
  whitespace_compression:     number;  // inverse of whitespace % → normalized (low whitespace = high compression)
  after_hours_density:        number;  // after-hours meetings % → normalized
  weekend_activity:           number;  // weekend activity days → normalized
}

// ───────────────────────────────────────────────
// TELEMETRY INDEXES  (0.0–1.0)
// ───────────────────────────────────────────────

export interface TelemetryIndexes {
  /** Telemetry Load Index™  — objective operational demand */
  tli: number;
  /** Telemetry Concentration Index™  — decision/routing concentration */
  tci: number;
  /** Recovery Pressure Index™  — recovery compression */
  rpi: number;
  /** Overall telemetry risk composite */
  telemetry_composite: number;
  /** Data confidence: how reliable the telemetry signals are */
  data_confidence: number;   // 0.0–1.0
  /** Signal completeness across all 17 input fields */
  signal_completeness: number;  // 0.0–1.0
}

export interface TelemetryResult {
  raw:     RawTelemetryInput;
  signals: TelemetrySignalVector;
  indexes: TelemetryIndexes;
  period_label: string;
  computed_at: string;
}

// ───────────────────────────────────────────────
// NORMALIZATION HELPERS
// Clamp and linear-scale raw values to 0–1
// ───────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Linear normalize: value → (v - min) / (max - min) clamped to [0,1] */
function norm(v: number, min: number, max: number): number {
  if (max <= min) return 0;
  return parseFloat(clamp((v - min) / (max - min), 0, 1).toFixed(4));
}

/** Percentage to 0–1 fraction */
function pctToFrac(pct: number): number {
  return parseFloat(clamp(pct / 100, 0, 1).toFixed(4));
}

// ───────────────────────────────────────────────
// SIGNAL NORMALIZATION
// Maps raw enterprise metrics → standardized 0–1 signal vectors
// ───────────────────────────────────────────────

export function normalizeSignals(raw: RawTelemetryInput): TelemetrySignalVector {
  return {
    // ── OPERATIONAL LOAD ──
    // Meeting hours: 0h=0.0, 20h=0.44, 35h=0.78, 50h+=1.0
    meeting_load: norm(raw.meeting_hours_per_week, 0, 45),

    // Decision approvals/week: 0=0.0, 10=0.2, 30=0.6, 50+=1.0
    approval_demand: norm(raw.decision_approvals_per_week, 0, 50),

    // Cross-functional % — high = more coordination overhead
    coordination_volume: pctToFrac(raw.cross_functional_meetings_pct),

    // Recurring burden — high % recurring = less flexibility, more lock-in
    recurring_burden: pctToFrac(raw.recurring_meeting_hours_pct),

    // Calendar fragmentation — higher = more cognitive interruption
    calendar_fragmentation: pctToFrac(raw.calendar_fragmentation_score),

    // ── DECISION ROUTING ──
    // % of org decisions requiring this leader
    approval_concentration: pctToFrac(raw.approvals_requiring_this_leader_pct),

    // Escalation frequency: 0=0.0, 5=0.33, 15=1.0
    escalation_rate: norm(raw.escalation_frequency_per_week, 0, 15),

    // Functions routing: 0=0.0, 5=0.33, 15+=1.0
    routing_dependency_count: norm(raw.decision_routing_dependencies, 0, 15),

    // % of cross-func approvals concentrated here
    cross_func_concentration: pctToFrac(raw.cross_func_approval_concentration),

    // ── STRUCTURAL DEPENDENCY ──
    // Projects owned: 0=0.0, 5=0.25, 20+=1.0
    project_concentration: norm(raw.active_projects_owned, 0, 20),

    // Functions dependent: 0=0.0, 3=0.25, 12+=1.0
    function_dependency: norm(raw.functions_dependent_count, 0, 12),

    // Routing breadth: 0=0.0, 5=0.33, 15+=1.0
    routing_breadth: norm(raw.routing_dependency_breadth, 0, 15),

    // SPOF score (already 0–100)
    failure_point_risk: pctToFrac(raw.single_point_of_failure_score),

    // ── RECOVERY COMPRESSION ──
    // Consecutive weeks overloaded: 0=0.0, 4=0.33, 12+=1.0
    sustained_overload: norm(raw.weeks_sustained_overload, 0, 12),

    // Whitespace compression = INVERSE of whitespace %
    // Low whitespace (e.g., 5%) → high compression (0.95)
    whitespace_compression: parseFloat(clamp(1 - raw.calendar_whitespace_pct / 100, 0, 1).toFixed(4)),

    // After-hours density: % of meetings outside business hours
    after_hours_density: pctToFrac(raw.after_hours_meetings_pct),

    // Weekend activity: 0 days=0.0, 2=0.25, 8+=1.0
    weekend_activity: norm(raw.weekend_activity_days_per_month, 0, 8),
  };
}

// ───────────────────────────────────────────────
// TLI — Telemetry Load Index™
// Composite of operational load signals
// Weighted: meeting_load and approval_demand are primary drivers
// ───────────────────────────────────────────────

export function computeTLI(signals: TelemetrySignalVector): number {
  const weighted = (
    signals.meeting_load           * 0.30 +
    signals.approval_demand        * 0.25 +
    signals.coordination_volume    * 0.15 +
    signals.recurring_burden       * 0.15 +
    signals.calendar_fragmentation * 0.15
  );
  return parseFloat(clamp(weighted, 0, 1).toFixed(4));
}

// ───────────────────────────────────────────────
// TCI — Telemetry Concentration Index™
// Composite of decision routing + structural dependency signals
// ───────────────────────────────────────────────

export function computeTCI(signals: TelemetrySignalVector): number {
  // Routing sub-index
  const routing = (
    signals.approval_concentration  * 0.35 +
    signals.escalation_rate         * 0.20 +
    signals.routing_dependency_count* 0.25 +
    signals.cross_func_concentration* 0.20
  );

  // Structural dependency sub-index
  const dependency = (
    signals.project_concentration * 0.30 +
    signals.function_dependency   * 0.30 +
    signals.routing_breadth       * 0.25 +
    signals.failure_point_risk    * 0.15
  );

  // TCI = equal blend of routing and structural dependency
  const tci = routing * 0.55 + dependency * 0.45;
  return parseFloat(clamp(tci, 0, 1).toFixed(4));
}

// ───────────────────────────────────────────────
// RPI — Recovery Pressure Index™
// Composite of recovery compression signals
// High RPI = leader has insufficient recovery bandwidth
// ───────────────────────────────────────────────

export function computeRPI(signals: TelemetrySignalVector): number {
  const weighted = (
    signals.sustained_overload    * 0.35 +
    signals.whitespace_compression* 0.30 +
    signals.after_hours_density   * 0.20 +
    signals.weekend_activity      * 0.15
  );
  return parseFloat(clamp(weighted, 0, 1).toFixed(4));
}

// ───────────────────────────────────────────────
// DATA CONFIDENCE SCORING
// Based on: data_completeness_pct + period_weeks coverage
// Short periods or incomplete data reduce confidence
// ───────────────────────────────────────────────

export function computeDataConfidence(raw: RawTelemetryInput): number {
  // Completeness component: 100% complete = 0.9 max confidence
  const completeness = norm(raw.data_completeness_pct, 0, 100) * 0.9;

  // Period coverage: 1 week = low, 4+ weeks = good, 8+ = excellent
  const periodScore = norm(raw.period_weeks, 0, 8) * 0.1;

  return parseFloat(clamp(completeness + periodScore, 0, 1).toFixed(4));
}

// ───────────────────────────────────────────────
// TELEMETRY COMPOSITE
// Single summary score for overall telemetry risk signal strength
// TLI and TCI equally weighted; RPI provides amplification
// ───────────────────────────────────────────────

export function computeTelemetryComposite(tli: number, tci: number, rpi: number): number {
  // Base = weighted blend of TLI and TCI
  const base = tli * 0.45 + tci * 0.45;
  // RPI amplifies: sustained recovery compression adds up to +0.10
  const amplified = base + rpi * 0.10;
  return parseFloat(clamp(amplified, 0, 1).toFixed(4));
}

// ───────────────────────────────────────────────
// MASTER: computeTelemetry()
// Single entry point for the telemetry signal processing pipeline
// ───────────────────────────────────────────────

export function computeTelemetry(raw: RawTelemetryInput): TelemetryResult {
  const signals  = normalizeSignals(raw);
  const tli      = computeTLI(signals);
  const tci      = computeTCI(signals);
  const rpi      = computeRPI(signals);
  const telemetry_composite = computeTelemetryComposite(tli, tci, rpi);
  const data_confidence     = computeDataConfidence(raw);
  const signal_completeness = pctToFrac(raw.data_completeness_pct);

  const indexes: TelemetryIndexes = {
    tli,
    tci,
    rpi,
    telemetry_composite,
    data_confidence,
    signal_completeness,
  };

  const periodLabel = raw.period_weeks >= 4
    ? `${raw.period_weeks}-week rolling window`
    : `${raw.period_weeks}-week snapshot`;

  return {
    raw,
    signals,
    indexes,
    period_label: periodLabel,
    computed_at:  new Date().toISOString(),
  };
}

// ───────────────────────────────────────────────
// TELEMETRY THRESHOLD METADATA
// Used for UI rendering and interpretation
// ───────────────────────────────────────────────

export const TLI_LEVELS = [
  { max: 0.20, label: 'Nominal Load',       color: '#10B981', bg: '#ECFDF5', description: 'Leadership demand within sustainable range.' },
  { max: 0.40, label: 'Elevated Load',      color: '#84CC16', bg: '#F7FEE7', description: 'Load above baseline; monitor for accumulation.' },
  { max: 0.60, label: 'High Load',          color: '#F59E0B', bg: '#FFFBEB', description: 'Sustained high operational demand detected.' },
  { max: 0.80, label: 'Load Saturation',    color: '#F97316', bg: '#FFF7ED', description: 'Operational load approaching structural limits.' },
  { max: 1.00, label: 'Critical Overload',  color: '#EF4444', bg: '#FEF2F2', description: 'Load levels incompatible with sustained effectiveness.' },
];

export const TCI_LEVELS = [
  { max: 0.15, label: 'Distributed',        color: '#10B981', bg: '#ECFDF5', description: 'Decision routing well distributed across leadership layer.' },
  { max: 0.30, label: 'Mild Concentration', color: '#84CC16', bg: '#F7FEE7', description: 'Some concentration but within healthy range.' },
  { max: 0.50, label: 'Structural Focus',   color: '#F59E0B', bg: '#FFFBEB', description: 'Significant concentration in routing and approvals.' },
  { max: 0.70, label: 'High Dependency',    color: '#F97316', bg: '#FFF7ED', description: 'Org-level decision dependency forming around this node.' },
  { max: 1.00, label: 'Critical Hub',       color: '#EF4444', bg: '#FEF2F2', description: 'Single-point-of-failure risk in decision architecture.' },
];

export const RPI_LEVELS = [
  { max: 0.20, label: 'Recovery Intact',      color: '#10B981', bg: '#ECFDF5', description: 'Adequate recovery bandwidth maintained.' },
  { max: 0.40, label: 'Mild Compression',     color: '#84CC16', bg: '#F7FEE7', description: 'Recovery time mildly compressed; watch trend.' },
  { max: 0.60, label: 'Compressed',           color: '#F59E0B', bg: '#FFFBEB', description: 'Recovery bandwidth significantly reduced.' },
  { max: 0.80, label: 'Severe Compression',   color: '#F97316', bg: '#FFF7ED', description: 'Persistent recovery compression; burnout risk elevated.' },
  { max: 1.00, label: 'Critical Depletion',   color: '#EF4444', bg: '#FEF2F2', description: 'Recovery capacity depleted; structural failure risk acute.' },
];

export function getTelemetryLevelMeta(
  value: number,
  levels: typeof TLI_LEVELS
): (typeof TLI_LEVELS)[0] {
  return levels.find(l => value <= l.max) ?? levels[levels.length - 1];
}

// ───────────────────────────────────────────────
// OPERATIONAL MODE CLASSIFICATION
// Based on what data is available for a leader
// ───────────────────────────────────────────────

export type OperationalMode = 'Assessment' | 'Calibrated' | 'Full Intelligence';

export function classifyOperationalMode(
  hasAssessment: boolean,
  hasTelemetry: boolean,
  telemetryConfidence: number
): OperationalMode {
  if (!hasAssessment) return 'Assessment';
  if (!hasTelemetry || telemetryConfidence < 0.3) return 'Assessment';
  if (telemetryConfidence < 0.70) return 'Calibrated';
  return 'Full Intelligence';
}

// ───────────────────────────────────────────────
// SIGNAL DOMAIN SUMMARIES (for UI domain cards)
// ───────────────────────────────────────────────

export interface TelemetryDomainSummary {
  domain: 'Operational Load' | 'Decision Routing' | 'Structural Dependency' | 'Recovery Compression';
  icon: string;
  index_value: number;
  index_label: string;
  color: string;
  signals: Array<{ label: string; value: number; raw_value: number; unit: string }>;
}

export function buildDomainSummaries(
  raw: RawTelemetryInput,
  signals: TelemetrySignalVector,
  tli: number,
  tci: number,
  rpi: number
): TelemetryDomainSummary[] {
  const tliMeta = getTelemetryLevelMeta(tli, TLI_LEVELS);
  const tciMeta = getTelemetryLevelMeta(tci, TCI_LEVELS);
  const rpiMeta = getTelemetryLevelMeta(rpi, RPI_LEVELS);

  return [
    {
      domain: 'Operational Load',
      icon: 'calendar-alt',
      index_value: tli,
      index_label: tliMeta.label,
      color: tliMeta.color,
      signals: [
        { label: 'Meeting hours/week',     value: signals.meeting_load,           raw_value: raw.meeting_hours_per_week,          unit: 'h/wk' },
        { label: 'Decision approvals/wk',  value: signals.approval_demand,        raw_value: raw.decision_approvals_per_week,     unit: '/wk' },
        { label: 'Cross-functional mtgs',  value: signals.coordination_volume,    raw_value: raw.cross_functional_meetings_pct,   unit: '%' },
        { label: 'Recurring meeting %',    value: signals.recurring_burden,       raw_value: raw.recurring_meeting_hours_pct,     unit: '%' },
        { label: 'Calendar fragmentation', value: signals.calendar_fragmentation, raw_value: raw.calendar_fragmentation_score,    unit: '%' },
      ],
    },
    {
      domain: 'Decision Routing',
      icon: 'route',
      index_value: tci,
      index_label: tciMeta.label,
      color: tciMeta.color,
      signals: [
        { label: 'Approval concentration',     value: signals.approval_concentration,   raw_value: raw.approvals_requiring_this_leader_pct, unit: '%' },
        { label: 'Escalation rate/week',       value: signals.escalation_rate,          raw_value: raw.escalation_frequency_per_week,       unit: '/wk' },
        { label: 'Functions routing here',     value: signals.routing_dependency_count, raw_value: raw.decision_routing_dependencies,        unit: 'functions' },
        { label: 'Cross-func concentration',   value: signals.cross_func_concentration, raw_value: raw.cross_func_approval_concentration,    unit: '%' },
      ],
    },
    {
      domain: 'Structural Dependency',
      icon: 'project-diagram',
      index_value: tci,
      index_label: tciMeta.label,
      color: tciMeta.color,
      signals: [
        { label: 'Active projects owned',    value: signals.project_concentration, raw_value: raw.active_projects_owned,          unit: 'projects' },
        { label: 'Dependent functions',      value: signals.function_dependency,   raw_value: raw.functions_dependent_count,      unit: 'functions' },
        { label: 'Routing breadth',          value: signals.routing_breadth,       raw_value: raw.routing_dependency_breadth,     unit: 'teams' },
        { label: 'SPOF risk score',          value: signals.failure_point_risk,    raw_value: raw.single_point_of_failure_score,  unit: '/100' },
      ],
    },
    {
      domain: 'Recovery Compression',
      icon: 'battery-quarter',
      index_value: rpi,
      index_label: rpiMeta.label,
      color: rpiMeta.color,
      signals: [
        { label: 'Weeks sustained overload', value: signals.sustained_overload,    raw_value: raw.weeks_sustained_overload,           unit: 'wks' },
        { label: 'Whitespace compression',   value: signals.whitespace_compression,raw_value: 100 - raw.calendar_whitespace_pct,      unit: '%' },
        { label: 'After-hours meeting %',    value: signals.after_hours_density,   raw_value: raw.after_hours_meetings_pct,           unit: '%' },
        { label: 'Weekend activity days',    value: signals.weekend_activity,      raw_value: raw.weekend_activity_days_per_month,    unit: 'days/mo' },
      ],
    },
  ];
}
