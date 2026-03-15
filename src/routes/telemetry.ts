// ═══════════════════════════════════════════════════════════════════════
// Structural Telemetry Layer™ — API Routes
// Leadership Risk Intelligence™ Platform — Hatch
//
// POST /telemetry/ingest          — ingest raw telemetry snapshot (admin)
// GET  /telemetry/:leaderId       — fetch latest fusion result for leader
// GET  /telemetry/org/summary     — org-level telemetry + fusion summary
// GET  /telemetry/sources         — list telemetry source configs for org
// POST /telemetry/sources         — add/update a telemetry source config
// ═══════════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import type { Bindings, Variables } from '../types/index.js';
import { requireAuth } from '../lib/auth.js';
import type { RiskScoreResult } from '../types/index.js';
import {
  computeTelemetry,
  classifyOperationalMode,
  type RawTelemetryInput,
} from '../lib/telemetry.js';
import { computeFusion } from '../lib/fusion.js';

const telemetry = new Hono<{ Bindings: Bindings; Variables: Variables }>();

telemetry.use('*', requireAuth);

// ─────────────────────────────────────────────────────────────────────
// POST /telemetry/ingest
// Ingest a raw telemetry snapshot for a leader
// Body: { leader_id, period_weeks, source_system, ...raw signals }
// ─────────────────────────────────────────────────────────────────────
telemetry.post('/ingest', async (c) => {
  const orgId      = c.get('orgId');
  const leaderRole = c.get('leaderRole');
  if (leaderRole !== 'admin') return c.json({ error: 'Admin required' }, 403);

  const body = await c.req.json<Partial<RawTelemetryInput & { leader_id: number; source_system?: string; period_start?: string; period_end?: string }>>().catch(() => null);
  if (!body || !body.leader_id) return c.json({ error: 'leader_id required' }, 400);

  // Fill defaults for any missing fields
  const raw: RawTelemetryInput = {
    meeting_hours_per_week:                body.meeting_hours_per_week        ?? 20,
    decision_approvals_per_week:           body.decision_approvals_per_week   ?? 10,
    cross_functional_meetings_pct:         body.cross_functional_meetings_pct ?? 40,
    recurring_meeting_hours_pct:           body.recurring_meeting_hours_pct   ?? 50,
    calendar_fragmentation_score:          body.calendar_fragmentation_score  ?? 30,
    approvals_requiring_this_leader_pct:   body.approvals_requiring_this_leader_pct ?? 15,
    escalation_frequency_per_week:         body.escalation_frequency_per_week ?? 2,
    decision_routing_dependencies:         body.decision_routing_dependencies  ?? 3,
    cross_func_approval_concentration:     body.cross_func_approval_concentration ?? 20,
    active_projects_owned:                 body.active_projects_owned         ?? 3,
    functions_dependent_count:             body.functions_dependent_count     ?? 2,
    routing_dependency_breadth:            body.routing_dependency_breadth    ?? 3,
    single_point_of_failure_score:         body.single_point_of_failure_score ?? 20,
    weeks_sustained_overload:              body.weeks_sustained_overload      ?? 1,
    calendar_whitespace_pct:               body.calendar_whitespace_pct       ?? 40,
    after_hours_meetings_pct:              body.after_hours_meetings_pct      ?? 10,
    weekend_activity_days_per_month:       body.weekend_activity_days_per_month ?? 0,
    period_weeks:                          body.period_weeks                  ?? 4,
    data_completeness_pct:                 body.data_completeness_pct         ?? 100,
  };

  // Compute telemetry indexes
  const result = computeTelemetry(raw);
  const idx    = result.indexes;

  // Persist snapshot
  const snap = await c.env.DB.prepare(`
    INSERT INTO telemetry_snapshots (
      leader_id, organization_id, source_system, period_start, period_end, period_weeks, data_completeness_pct,
      meeting_hours_per_week, decision_approvals_per_week, cross_functional_meetings_pct,
      recurring_meeting_hours_pct, calendar_fragmentation_score,
      approvals_requiring_this_leader_pct, escalation_frequency_per_week,
      decision_routing_dependencies, cross_func_approval_concentration,
      active_projects_owned, functions_dependent_count, routing_dependency_breadth, single_point_of_failure_score,
      weeks_sustained_overload, calendar_whitespace_pct, after_hours_meetings_pct, weekend_activity_days_per_month,
      tli, tci, rpi, telemetry_composite, data_confidence
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    body.leader_id, orgId,
    body.source_system ?? 'api',
    body.period_start ?? null,
    body.period_end   ?? null,
    raw.period_weeks, raw.data_completeness_pct,
    raw.meeting_hours_per_week, raw.decision_approvals_per_week, raw.cross_functional_meetings_pct,
    raw.recurring_meeting_hours_pct, raw.calendar_fragmentation_score,
    raw.approvals_requiring_this_leader_pct, raw.escalation_frequency_per_week,
    raw.decision_routing_dependencies, raw.cross_func_approval_concentration,
    raw.active_projects_owned, raw.functions_dependent_count, raw.routing_dependency_breadth, raw.single_point_of_failure_score,
    raw.weeks_sustained_overload, raw.calendar_whitespace_pct, raw.after_hours_meetings_pct, raw.weekend_activity_days_per_month,
    idx.tli, idx.tci, idx.rpi, idx.telemetry_composite, idx.data_confidence
  ).run();

  const snapshotId = snap.meta.last_row_id;

  // Compute fusion if assessment data exists
  const assessmentRow = await c.env.DB.prepare(`
    SELECT rs.*, a.assessment_id
    FROM risk_scores rs JOIN assessments a ON a.assessment_id=rs.assessment_id
    WHERE rs.leader_id=? AND rs.organization_id=? AND a.status='completed'
    ORDER BY rs.created_at DESC LIMIT 1
  `).bind(body.leader_id, orgId).first();

  let fusionId: number | null = null;
  if (assessmentRow) {
    const scores: RiskScoreResult = {
      stress_regulation:     assessmentRow.stress_regulation as number,
      cognitive_breadth:     assessmentRow.cognitive_breadth as number,
      trust_climate:         assessmentRow.trust_climate as number,
      ethical_integrity:     assessmentRow.ethical_integrity as number,
      leadership_durability: assessmentRow.leadership_durability as number,
      adaptive_capacity:     assessmentRow.adaptive_capacity as number,
      lsi:                   assessmentRow.lsi as number,
      lsi_norm:              (assessmentRow.lsi_norm as number) ?? ((assessmentRow.lsi as number) / 5),
      domain_variance:       (assessmentRow.domain_variance as number) ?? 0,
      signal_pattern:        assessmentRow.signal_pattern as any,
      lli_raw:               (assessmentRow.lli_raw as number) ?? 0,
      lli_norm:              assessmentRow.lli_norm as number,
      cei:                   assessmentRow.cei as number,
      cascade_stage:         assessmentRow.cascade_stage as any,
      cascade_level:         (assessmentRow.cascade_level as number) ?? 1,
      risk_score:            assessmentRow.risk_score as number,
      risk_level:            assessmentRow.risk_level as any,
      trajectory_direction:  (assessmentRow.trajectory_direction as any) ?? 'Stable',
    };

    const fusion = computeFusion(scores, result);

    const fr = await c.env.DB.prepare(`
      INSERT INTO fusion_results (
        leader_id, organization_id, assessment_id, snapshot_id,
        operational_mode, telemetry_confidence,
        assessment_lli_norm, assessment_cei, assessment_lsi_norm, assessment_risk_score, assessment_risk_level,
        calibrated_lli_norm, calibrated_cei, calibrated_risk_score, calibrated_risk_level,
        calibrated_cascade_stage, calibrated_cascade_level, calibrated_rpi,
        divergence_pattern, divergence_severity, lli_divergence, cei_divergence, divergence_magnitude,
        confidence_overall, confidence_label, fusion_insight
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      body.leader_id, orgId, assessmentRow.assessment_id, snapshotId,
      fusion.mode, fusion.telemetry_confidence,
      fusion.assessment.lli_norm, fusion.assessment.cei, fusion.assessment.lsi_norm,
      fusion.assessment.risk_score, fusion.assessment.risk_level,
      fusion.calibrated.lli_norm, fusion.calibrated.cei,
      fusion.calibrated.risk_score, fusion.calibrated.risk_level,
      fusion.calibrated.cascade_stage, fusion.calibrated.cascade_level, fusion.calibrated.rpi,
      fusion.divergence.pattern ?? 'None', fusion.divergence.severity,
      fusion.divergence.lli_divergence, fusion.divergence.cei_divergence, fusion.divergence.divergence_magnitude,
      fusion.confidence.overall, fusion.confidence.label,
      fusion.fusion_insight
    ).run();

    fusionId = fr.meta.last_row_id;
  }

  return c.json({
    success: true,
    snapshot_id: snapshotId,
    fusion_id:   fusionId,
    telemetry: {
      tli: idx.tli,
      tci: idx.tci,
      rpi: idx.rpi,
      telemetry_composite: idx.telemetry_composite,
      data_confidence: idx.data_confidence,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────
// GET /telemetry/:leaderId
// Returns latest telemetry snapshot + fusion result for a leader
// ─────────────────────────────────────────────────────────────────────
telemetry.get('/:leaderId', async (c) => {
  const orgId      = c.get('orgId');
  const myLeaderId = c.get('leaderId');
  const leaderRole = c.get('leaderRole');
  const leaderId   = parseInt(c.req.param('leaderId'), 10);

  if (leaderRole !== 'admin' && myLeaderId !== leaderId) {
    return c.json({ error: 'Access denied' }, 403);
  }

  // Latest telemetry snapshot
  const snap = await c.env.DB.prepare(`
    SELECT * FROM telemetry_snapshots
    WHERE leader_id=? AND organization_id=?
    ORDER BY created_at DESC LIMIT 1
  `).bind(leaderId, orgId).first();

  // Latest fusion result
  const fusion = await c.env.DB.prepare(`
    SELECT * FROM fusion_results
    WHERE leader_id=? AND organization_id=?
    ORDER BY created_at DESC LIMIT 1
  `).bind(leaderId, orgId).first();

  // Historical telemetry (last 8 periods)
  const history = await c.env.DB.prepare(`
    SELECT snapshot_id, tli, tci, rpi, telemetry_composite, data_confidence,
           period_weeks, source_system, created_at
    FROM telemetry_snapshots
    WHERE leader_id=? AND organization_id=?
    ORDER BY created_at DESC LIMIT 8
  `).bind(leaderId, orgId).all();

  const operational_mode = snap
    ? classifyOperationalMode(true, true, (snap.data_confidence as number) ?? 0)
    : 'Assessment';

  return c.json({
    leader_id: leaderId,
    operational_mode,
    has_telemetry: !!snap,
    latest_snapshot: snap ?? null,
    latest_fusion:   fusion ?? null,
    telemetry_history: history.results ?? [],
  });
});

// ─────────────────────────────────────────────────────────────────────
// GET /telemetry/org/summary
// Organization-level telemetry and fusion analytics
// ─────────────────────────────────────────────────────────────────────
telemetry.get('/org/summary', async (c) => {
  const orgId      = c.get('orgId');
  const leaderRole = c.get('leaderRole');
  if (leaderRole !== 'admin') return c.json({ error: 'Admin required' }, 403);

  // All leaders with their latest telemetry
  const leaders = await c.env.DB.prepare(`
    SELECT l.leader_id, l.name, l.role_level,
           t.tli, t.tci, t.rpi, t.telemetry_composite, t.data_confidence, t.created_at AS telemetry_at,
           f.operational_mode, f.calibrated_risk_score, f.calibrated_risk_level,
           f.assessment_risk_score, f.divergence_pattern, f.divergence_severity,
           f.confidence_overall, f.fusion_insight
    FROM leaders l
    LEFT JOIN telemetry_snapshots t ON t.leader_id=l.leader_id AND t.organization_id=?
      AND t.created_at = (SELECT MAX(ts2.created_at) FROM telemetry_snapshots ts2 WHERE ts2.leader_id=l.leader_id AND ts2.organization_id=?)
    LEFT JOIN fusion_results f ON f.leader_id=l.leader_id AND f.organization_id=?
      AND f.created_at = (SELECT MAX(fr2.created_at) FROM fusion_results fr2 WHERE fr2.leader_id=l.leader_id AND fr2.organization_id=?)
    WHERE l.organization_id=? AND l.system_role='leader'
    ORDER BY COALESCE(f.calibrated_risk_score, 0) DESC
  `).bind(orgId, orgId, orgId, orgId, orgId).all();

  const rows = leaders.results ?? [];

  // Aggregate metrics
  const withTelemetry = rows.filter(r => r.tli !== null);
  const withFusion    = rows.filter(r => r.operational_mode !== null && r.operational_mode !== 'Assessment');
  const avgTLI = withTelemetry.length
    ? parseFloat((withTelemetry.reduce((s, r) => s + (r.tli as number), 0) / withTelemetry.length).toFixed(3))
    : null;
  const avgTCI = withTelemetry.length
    ? parseFloat((withTelemetry.reduce((s, r) => s + (r.tci as number), 0) / withTelemetry.length).toFixed(3))
    : null;
  const avgRPI = withTelemetry.length
    ? parseFloat((withTelemetry.reduce((s, r) => s + (r.rpi as number), 0) / withTelemetry.length).toFixed(3))
    : null;

  // Divergence distribution
  const divergenceCounts: Record<string, number> = {};
  rows.forEach(r => {
    const p = (r.divergence_pattern as string) ?? 'No telemetry';
    divergenceCounts[p] = (divergenceCounts[p] ?? 0) + 1;
  });

  // Mode distribution
  const modeCounts: Record<string, number> = {};
  rows.forEach(r => {
    const m = (r.operational_mode as string) ?? 'Assessment';
    modeCounts[m] = (modeCounts[m] ?? 0) + 1;
  });

  // Source configs
  const sources = await c.env.DB.prepare(
    'SELECT * FROM telemetry_source_configs WHERE organization_id=?'
  ).bind(orgId).all();

  return c.json({
    organization_id: orgId,
    total_leaders: rows.length,
    telemetry_active: withTelemetry.length,
    fusion_active: withFusion.length,
    portfolio_telemetry: {
      avg_tli: avgTLI,
      avg_tci: avgTCI,
      avg_rpi: avgRPI,
    },
    divergence_distribution: divergenceCounts,
    mode_distribution: modeCounts,
    source_configs: sources.results ?? [],
    leaders: rows,
  });
});

// ─────────────────────────────────────────────────────────────────────
// GET /telemetry/sources
// List telemetry source configs for the organization
// ─────────────────────────────────────────────────────────────────────
telemetry.get('/sources', async (c) => {
  const orgId = c.get('orgId');
  const rows  = await c.env.DB.prepare(
    'SELECT * FROM telemetry_source_configs WHERE organization_id=? ORDER BY source_type'
  ).bind(orgId).all();
  return c.json({ sources: rows.results ?? [] });
});

// ─────────────────────────────────────────────────────────────────────
// POST /telemetry/sources
// Add or update a telemetry source configuration (admin only)
// ─────────────────────────────────────────────────────────────────────
telemetry.post('/sources', async (c) => {
  const orgId      = c.get('orgId');
  const leaderRole = c.get('leaderRole');
  if (leaderRole !== 'admin') return c.json({ error: 'Admin required' }, 403);

  const body = await c.req.json<{
    source_type: string;
    source_label?: string;
    is_active?: boolean;
    sync_frequency_days?: number;
    notes?: string;
  }>().catch(() => null);

  if (!body?.source_type) return c.json({ error: 'source_type required' }, 400);

  // Upsert by org + source_type
  const existing = await c.env.DB.prepare(
    'SELECT config_id FROM telemetry_source_configs WHERE organization_id=? AND source_type=?'
  ).bind(orgId, body.source_type).first();

  if (existing) {
    await c.env.DB.prepare(`
      UPDATE telemetry_source_configs
      SET source_label=?, is_active=?, sync_frequency_days=?, notes=?
      WHERE config_id=?
    `).bind(
      body.source_label ?? body.source_type,
      body.is_active ? 1 : 0,
      body.sync_frequency_days ?? 7,
      body.notes ?? null,
      existing.config_id
    ).run();
    return c.json({ success: true, action: 'updated', config_id: existing.config_id });
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO telemetry_source_configs (organization_id, source_type, source_label, is_active, sync_frequency_days, notes)
    VALUES (?,?,?,?,?,?)
  `).bind(
    orgId, body.source_type,
    body.source_label ?? body.source_type,
    body.is_active ? 1 : 0,
    body.sync_frequency_days ?? 7,
    body.notes ?? null
  ).run();

  return c.json({ success: true, action: 'created', config_id: result.meta.last_row_id });
});

export default telemetry;
