// Leadership Risk Intelligence™ — REST API Routes
// POST /api/signals/calculate
// POST /api/risk/calculate
// GET  /api/leader/:id/brief
// GET  /api/leader/:id/interventions  ← NEW: Structural Intervention Engine™
// POST /api/decisions/ingest
// GET  /api/org/portfolio

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings, Variables } from '../types/index.js';
import { requireAuth } from '../lib/auth.js';
import {
  computeDomainScore, computeLSI, computeDomainVariance,
  computeLLI, computeCEI, computeCascadeStage, computeRiskScore,
  classifyRiskLevel, classifySignalPattern, computeTrajectory,
  CASCADE_STAGES, RISK_LEVELS, SIGNAL_PATTERN_META,
} from '../lib/scoring.js';
import { QUESTIONS, DOMAIN_KEYS, DOMAIN_META } from '../lib/questions.js';
import type { SignalDomain, RiskScoreResult } from '../types/index.js';
import { computeInterventions } from '../lib/interventions.js';

const api = new Hono<{ Bindings: Bindings; Variables: Variables }>();

api.use('*', cors({
  origin: '*',
  allowMethods: ['GET','POST','OPTIONS'],
  allowHeaders: ['Content-Type','Authorization'],
}));

// ─────────────────────────────────────────────────────────────
// POST /api/signals/calculate
// Body: { leader_id?, responses: [{question_id, response_value}] }
// Returns: domain_scores, LSI, LLI, signal_pattern, domain_variance
// ─────────────────────────────────────────────────────────────
api.post('/signals/calculate', async (c) => {
  const body = await c.req.json<{
    leader_id?: number;
    responses: Array<{ question_id: string; response_value: number }>;
  }>();

  if (!body.responses || !Array.isArray(body.responses)) {
    return c.json({ error: 'responses array required' }, 400);
  }

  const responsesMap = new Map<string, number>();
  for (const r of body.responses) {
    if (r.question_id && r.response_value >= 1 && r.response_value <= 5) {
      responsesMap.set(r.question_id, r.response_value);
    }
  }

  // Compute domain scores
  const domainScores = {} as Record<SignalDomain, number>;
  for (const domain of DOMAIN_KEYS) {
    domainScores[domain] = computeDomainScore(domain, responsesMap);
  }

  const lsi = computeLSI(domainScores);
  const domain_variance = computeDomainVariance(domainScores);
  const { lli_raw, lli_norm } = computeLLI(responsesMap);
  const signal_pattern = classifySignalPattern(domainScores, lsi, domain_variance, lli_norm, 0.35);

  return c.json({
    domain_scores: {
      stress_regulation:     domainScores.stress_regulation,
      cognitive_breadth:     domainScores.cognitive_breadth,
      trust_climate:         domainScores.trust_climate,
      ethical_integrity:     domainScores.ethical_integrity,
      leadership_durability: domainScores.leadership_durability,
      adaptive_capacity:     domainScores.adaptive_capacity,
    },
    lsi,
    domain_variance,
    lli_raw,
    lli_norm,
    signal_pattern,
    meta: {
      formula: 'LSI = (SR + CB + TC + EI + LD + AC) / 6  → range 1.0–5.0',
      lli_formula: 'LLI_norm = (LLI_raw - 1) / 4  → range 0.0–1.0',
      questions_answered: responsesMap.size,
    },
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/risk/calculate
// Body: { lsi, lli_norm, cei_leader_decisions, cei_total_decisions, historical_scores? }
// Returns: LLI_norm, CEI, risk_score, cascade_stage, risk_level
// ─────────────────────────────────────────────────────────────
api.post('/risk/calculate', async (c) => {
  const body = await c.req.json<{
    lsi: number;
    lli_norm: number;
    cei_leader_decisions: number;
    cei_total_decisions: number;
    historical_scores?: number[];
  }>();

  const { lsi, lli_norm, cei_leader_decisions, cei_total_decisions } = body;

  if (!lsi || lsi < 1 || lsi > 5) {
    return c.json({ error: 'lsi must be between 1.0 and 5.0' }, 400);
  }
  if (lli_norm === undefined || lli_norm < 0 || lli_norm > 1) {
    return c.json({ error: 'lli_norm must be between 0.0 and 1.0' }, 400);
  }

  const cei = computeCEI(cei_leader_decisions ?? 38, cei_total_decisions ?? 100);
  const risk_score = computeRiskScore(lsi, lli_norm, cei);
  const { stage: cascade_stage, level: cascade_level, stageMeta } = computeCascadeStage(risk_score);
  const risk_level = classifyRiskLevel(risk_score);
  const trajectory = computeTrajectory(risk_score, body.historical_scores ?? []);

  return c.json({
    inputs: { lsi, lli_norm, cei_leader_decisions, cei_total_decisions },
    cei,
    cascade_stage,
    cascade_level,
    risk_score,
    risk_level,
    trajectory_direction: trajectory,
    formula: '(CEI × LLI_norm) / LSI_norm  [v3.1 — all variables 0–1 range]',
    lsi_norm: parseFloat((lsi / 5).toFixed(4)),
    cascade_description: stageMeta.description,
    cascade_basis: 'Risk Score (v3.1 — not CEI alone)',
    risk_bands: [
      { range: '< 0.030',     level: 'Low Structural Risk',  cascade: 'Healthy Distribution' },
      { range: '0.030–0.080', level: 'Early Exposure',       cascade: 'Early Exposure' },
      { range: '0.080–0.150', level: 'Emerging Dependency',  cascade: 'Emerging Dependency' },
      { range: '0.150–0.300', level: 'Structural Bottleneck', cascade: 'Structural Bottleneck' },
      { range: '> 0.300',     level: 'Organizational Drag',  cascade: 'Organizational Drag' },
    ],
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/leader/:id/brief
// Returns structured JSON for full executive brief
// ─────────────────────────────────────────────────────────────
api.get('/leader/:id/brief', requireAuth, async (c) => {
  const orgId    = c.get('orgId');
  const leaderId = parseInt(c.req.param('id'));

  // Admin can view any leader in org; leader can only view self
  const leaderRole = c.get('leaderRole');
  const selfId     = c.get('leaderId');
  if (leaderRole !== 'admin' && selfId !== leaderId) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const row = await c.env.DB.prepare(`
    SELECT a.assessment_id, a.future_orientation, a.completed_at,
           rs.*, l.name, l.email, l.role_level, l.title,
           o.name as org_name, o.industry
    FROM assessments a
    JOIN risk_scores rs ON rs.assessment_id = a.assessment_id
    JOIN leaders l ON l.leader_id = a.leader_id
    JOIN organizations o ON o.organization_id = l.organization_id
    WHERE a.leader_id = ? AND o.organization_id = ?
      AND a.status = 'completed'
    ORDER BY a.completed_at DESC LIMIT 1
  `).bind(leaderId, orgId).first<Record<string, unknown>>();

  if (!row) return c.json({ error: 'No completed assessment found' }, 404);

  // Historical trajectory
  const hist = await c.env.DB.prepare(
    'SELECT risk_score, created_at FROM risk_scores WHERE leader_id=? ORDER BY created_at DESC LIMIT 8'
  ).bind(leaderId).all<{ risk_score: number; created_at: string }>();

  const historical = hist.results ?? [];

  return c.json({
    leader: {
      id: leaderId,
      name: row.name,
      email: row.email,
      role_level: row.role_level,
      title: row.title,
      organization: row.org_name,
      industry: row.industry,
    },
    assessment: {
      id: row.assessment_id,
      completed_at: row.completed_at,
      future_orientation: row.future_orientation,
    },
    scores: {
      domain_scores: {
        stress_regulation:     row.stress_regulation,
        cognitive_breadth:     row.cognitive_breadth,
        trust_climate:         row.trust_climate,
        ethical_integrity:     row.ethical_integrity,
        leadership_durability: row.leadership_durability,
        adaptive_capacity:     row.adaptive_capacity,
      },
      lsi:            row.lsi,
      domain_variance: row.domain_variance,
      signal_pattern: row.signal_pattern,
      lli_raw:        row.lli_raw,
      lli_norm:       row.lli_norm,
      cei:            row.cei,
      cascade_stage:  row.cascade_stage,
      cascade_level:  row.cascade_level,
      risk_score:     row.risk_score,
      risk_level:     row.risk_level,
      trajectory_direction: row.trajectory_direction,
    },
    history: historical.map(h => ({
      risk_score: h.risk_score,
      date: h.created_at,
    })),
    formulas: {
      lsi:        'LSI = (SR + CB + TC + EI + LD + AC) / 6  → range 1.0–5.0',
      lsi_norm:   'LSI_norm = LSI / 5  → range 0.0–1.0',
      lli_norm:   'LLI_norm = (LLI_raw - 1) / 4  → range 0.0–1.0',
      cei:        'CEI = leader_decisions / total_decisions  → range 0.0–1.0',
      risk_score: 'Risk Score = (CEI × LLI_norm) / LSI_norm  [v3.1 — all inputs 0–1]',
      cascade:    'Cascade Stage = classified by Risk Score (not CEI alone)',
    },
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/org/portfolio
// Returns org-level aggregated risk data
// ─────────────────────────────────────────────────────────────
api.get('/org/portfolio', requireAuth, async (c) => {
  const orgId      = c.get('orgId');
  const leaderRole = c.get('leaderRole');

  if (leaderRole !== 'admin') return c.json({ error: 'Admin access required' }, 403);

  const leaders = await c.env.DB.prepare(`
    SELECT l.leader_id, l.name, l.role_level,
           rs.lsi, rs.lli_norm, rs.cei, rs.risk_score, rs.risk_level,
           rs.cascade_stage, rs.cascade_level, rs.signal_pattern,
           rs.stress_regulation, rs.cognitive_breadth, rs.trust_climate,
           rs.ethical_integrity, rs.leadership_durability, rs.adaptive_capacity,
           a.completed_at
    FROM leaders l
    LEFT JOIN assessments a ON a.assessment_id = (
      SELECT assessment_id FROM assessments
      WHERE leader_id=l.leader_id AND status='completed'
      ORDER BY completed_at DESC LIMIT 1
    )
    LEFT JOIN risk_scores rs ON rs.assessment_id = a.assessment_id
    WHERE l.organization_id = ?
    ORDER BY rs.risk_score DESC NULLS LAST
  `).bind(orgId).all<Record<string, unknown>>();

  const all = leaders.results ?? [];
  const assessed = all.filter(l => l.risk_score !== null);

  const avgRisk = assessed.length > 0
    ? assessed.reduce((s, l) => s + (l.risk_score as number), 0) / assessed.length
    : null;
  const avgLSI = assessed.length > 0
    ? assessed.reduce((s, l) => s + (l.lsi as number), 0) / assessed.length
    : null;

  const riskDistribution: Record<string, number> = {};
  const cascadeDistribution: Record<string, number> = {};
  const patternDistribution: Record<string, number> = {};

  for (const l of assessed) {
    const rl = l.risk_level as string;
    const cs = l.cascade_stage as string;
    const sp = l.signal_pattern as string;
    riskDistribution[rl]    = (riskDistribution[rl] ?? 0) + 1;
    cascadeDistribution[cs] = (cascadeDistribution[cs] ?? 0) + 1;
    patternDistribution[sp] = (patternDistribution[sp] ?? 0) + 1;
  }

  return c.json({
    organization_id: orgId,
    total_leaders: all.length,
    assessed_leaders: assessed.length,
    portfolio_metrics: {
      avg_risk_score: avgRisk ? parseFloat(avgRisk.toFixed(4)) : null,
      avg_lsi:        avgLSI  ? parseFloat(avgLSI.toFixed(3))  : null,
      at_risk_count:  (riskDistribution['Structural Bottleneck'] ?? 0) + (riskDistribution['Organizational Drag'] ?? 0),
    },
    risk_distribution:    riskDistribution,
    cascade_distribution: cascadeDistribution,
    pattern_distribution: patternDistribution,
    leaders: all.map(l => ({
      id:             l.leader_id,
      name:           l.name,
      role_level:     l.role_level,
      risk_score:     l.risk_score,
      risk_level:     l.risk_level,
      cascade_stage:  l.cascade_stage,
      signal_pattern: l.signal_pattern,
      lsi:            l.lsi,
      lli_norm:       l.lli_norm,
      cei:            l.cei,
      last_assessed:  l.completed_at,
    })),
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/decisions/ingest
// Body: { events: [{ leader_id, total_decisions, leader_decisions }] }
// Updates CEI-related data
// ─────────────────────────────────────────────────────────────
api.post('/decisions/ingest', requireAuth, async (c) => {
  const orgId      = c.get('orgId');
  const leaderRole = c.get('leaderRole');
  if (leaderRole !== 'admin') return c.json({ error: 'Admin required' }, 403);

  const body = await c.req.json<{
    events: Array<{
      leader_id: number;
      total_decisions: number;
      leader_decisions: number;
      decision_type?: string;
    }>;
  }>();

  if (!body.events?.length) return c.json({ error: 'events array required' }, 400);

  const inserts = body.events.map(e =>
    c.env.DB.prepare(
      'INSERT INTO decision_events (leader_id,organization_id,initiated_by,resolved_by,decision_type) VALUES (?,?,?,?,?)'
    ).bind(e.leader_id, orgId, e.leader_id, e.leader_id, e.decision_type ?? 'operational')
  );

  await c.env.DB.batch(inserts);

  return c.json({ success: true, ingested: body.events.length });
});

// ─────────────────────────────────────────────────────────────
// GET /api/leader/:id/interventions
// Returns full Structural Intervention Engine™ report as JSON
// ─────────────────────────────────────────────────────────────
api.get('/leader/:id/interventions', requireAuth, async (c) => {
  const leaderId   = parseInt(c.req.param('id'), 10);
  const orgId      = c.get('orgId');
  const leaderRole = c.get('leaderRole');
  const myLeaderId = c.get('leaderId');

  // Access control: admins can view any leader; leaders only themselves
  if (leaderRole !== 'admin' && myLeaderId !== leaderId) {
    return c.json({ error: 'Access denied' }, 403);
  }

  // Fetch latest completed assessment + risk scores
  const row = await c.env.DB.prepare(`
    SELECT rs.*, a.completed_at, l.name, l.role_level,
           o.name AS org_name
    FROM risk_scores rs
    JOIN assessments a  ON a.assessment_id = rs.assessment_id
    JOIN leaders l      ON l.leader_id = rs.leader_id
    JOIN organizations o ON o.organization_id = rs.organization_id
    WHERE rs.leader_id=? AND rs.organization_id=? AND a.status='completed'
    ORDER BY rs.created_at DESC LIMIT 1
  `).bind(leaderId, orgId).first();

  if (!row) return c.json({ error: 'No completed assessment found' }, 404);

  const scores: RiskScoreResult = {
    stress_regulation:     row.stress_regulation as number,
    cognitive_breadth:     row.cognitive_breadth as number,
    trust_climate:         row.trust_climate as number,
    ethical_integrity:     row.ethical_integrity as number,
    leadership_durability: row.leadership_durability as number,
    adaptive_capacity:     row.adaptive_capacity as number,
    lsi:                   row.lsi as number,
    lsi_norm:              (row.lsi_norm as number) ?? ((row.lsi as number) / 5),
    domain_variance:       (row.domain_variance as number) ?? 0,
    signal_pattern:        row.signal_pattern as any,
    lli_raw:               (row.lli_raw as number) ?? 0,
    lli_norm:              row.lli_norm as number,
    cei:                   row.cei as number,
    cascade_stage:         row.cascade_stage as any,
    cascade_level:         (row.cascade_level as number) ?? 1,
    risk_score:            row.risk_score as number,
    risk_level:            row.risk_level as any,
    trajectory_direction:  (row.trajectory_direction as any) ?? 'Stable',
  };

  // Historical scores for trajectory modelling
  const hist = await c.env.DB.prepare(
    'SELECT risk_score FROM risk_scores WHERE leader_id=? ORDER BY created_at DESC LIMIT 8'
  ).bind(leaderId).all<{ risk_score: number }>();
  const historicalScores = (hist.results ?? []).map(h => h.risk_score).slice(1);

  // Org-level peer scores for Executive Dependency detection
  const orgScores = await c.env.DB.prepare(`
    SELECT l.name, l.role_level, rs.risk_score, rs.cei, rs.lli_norm, rs.lsi
    FROM risk_scores rs
    JOIN leaders l ON l.leader_id = rs.leader_id
    WHERE rs.organization_id=?
    ORDER BY rs.created_at DESC
  `).bind(orgId).all<{ name: string; role_level: string; risk_score: number; cei: number; lli_norm: number; lsi: number }>();

  const orgLeaderScores = (orgScores.results ?? []);

  const report = computeInterventions(scores, historicalScores, orgLeaderScores);

  return c.json({
    leader_id:    leaderId,
    leader_name:  row.name as string,
    role_level:   row.role_level as string,
    assessment_date: row.completed_at as string,
    scores: {
      risk_score:    scores.risk_score,
      risk_level:    scores.risk_level,
      cascade_stage: scores.cascade_stage,
      lsi:           scores.lsi,
      lsi_norm:      scores.lsi_norm,
      lli_norm:      scores.lli_norm,
      cei:           scores.cei,
    },
    intervention_engine: {
      primary_pattern:           report.primary_pattern,
      is_compound:               report.is_compound,
      system_recommendation:     report.system_recommendation,
      escalation_probability_90d: report.escalation_probability_90d,
      time_to_next_cascade_days: report.time_to_next_cascade_days,
      estimated_cost_of_inaction: report.estimated_cost_of_inaction,
      signals: report.signals.map(s => ({
        pattern:     s.pattern,
        label:       s.label,
        description: s.description,
        evidence:    s.evidence,
        severity:    s.severity,
        urgency:     s.urgency,
        confidence:  s.confidence,
      })),
      interventions: report.interventions.map(i => ({
        id:                       i.id,
        type:                     i.type,
        title:                    i.title,
        rationale:                i.rationale,
        time_to_escalation_days:  i.time_to_escalation_days,
        expected_risk_reduction:  i.expected_risk_reduction,
        expected_risk_pct:        i.expected_risk_pct,
        implementation_weeks:     i.implementation_weeks,
        effort:                   i.effort,
        owner:                    i.owner,
        priority:                 i.priority,
        actions:                  i.actions,
      })),
      projections: report.projections,
    },
  });
});

export default api;
