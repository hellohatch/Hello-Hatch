// Organization Dashboard — Enterprise Portfolio View (v3.2 — Telemetry Architecture)
// NEW: Decision Gravity Map, Portfolio Risk Distribution, Org Risk Heatmap, Decision Velocity
// NEW v3.2: Intervention Intelligence Panel, Portfolio Escalation Monitor
// NEW v3.2: Structural Telemetry Layer™ integration

import { Hono } from 'hono';
import type { Bindings, Variables } from '../types/index.js';
import { requireAuth } from '../lib/auth.js';
import { hashPassword } from '../lib/auth.js';
import { CASCADE_STAGES, RISK_LEVELS, SIGNAL_PATTERN_META } from '../lib/scoring.js';
import { DOMAIN_META, DOMAIN_KEYS } from '../lib/questions.js';
import { computeInterventions } from '../lib/interventions.js';
import { renderOrgInterventionSummary } from '../lib/interventionUI.js';
import { renderOrgTelemetrySummary } from '../lib/telemetryUI.js';

const org = new Hono<{ Bindings: Bindings; Variables: Variables }>();
org.use('*', requireAuth);

// ── GET /org ── Portfolio Overview
org.get('/', async (c) => {
  const orgId      = c.get('orgId');
  const leaderName = c.get('leaderName');
  const leaderRole = c.get('leaderRole');

  const orgRow = await c.env.DB.prepare('SELECT * FROM organizations WHERE organization_id=?')
    .bind(orgId).first<{ name: string; industry: string; employee_count: number }>();

  // All leaders with latest scores + lsi_norm
  const leaders = await c.env.DB.prepare(`
    SELECT l.leader_id, l.name, l.email, l.role_level, l.system_role, l.created_at, l.manager_id,
           rs.lsi, rs.lsi_norm, rs.lli_norm, rs.cei, rs.risk_score, rs.risk_level,
           rs.cascade_stage, rs.cascade_level, rs.signal_pattern, rs.trajectory_direction,
           rs.stress_regulation, rs.cognitive_breadth, rs.trust_climate,
           rs.ethical_integrity, rs.leadership_durability, rs.adaptive_capacity,
           a.completed_at, a.assessment_id as latest_assessment_id,
           (SELECT COUNT(*) FROM assessments WHERE leader_id=l.leader_id AND status='completed') as total_assessments,
           (SELECT COUNT(*) FROM decision_events WHERE resolved_by=l.leader_id AND timestamp >= datetime('now','-30 days')) as decisions_30d
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

  // Total org decisions in last 30 days
  const totalDecisions = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM decision_events WHERE organization_id=? AND timestamp >= datetime('now','-30 days')`
  ).bind(orgId).first<{ cnt: number }>();

  const all      = leaders.results ?? [];
  const assessed = all.filter(l => l.risk_score !== null);

  const avgRisk = assessed.length > 0
    ? assessed.reduce((s, l) => s + (l.risk_score as number), 0) / assessed.length : null;
  const avgLSI  = assessed.length > 0
    ? assessed.reduce((s, l) => s + (l.lsi as number), 0) / assessed.length : null;

  // Risk distribution (v3.1 bands)
  const riskBuckets: Record<string, number> = {
    'Low Structural Risk': 0, 'Early Exposure': 0,
    'Emerging Dependency': 0, 'Structural Bottleneck': 0, 'Organizational Drag': 0,
  };
  const cascadeBuckets: Record<string, number> = {};
  const patternBuckets: Record<string, number> = {};

  for (const l of assessed) {
    const rl = l.risk_level as string;
    const cs = l.cascade_stage as string;
    const sp = l.signal_pattern as string;
    if (riskBuckets[rl] !== undefined) riskBuckets[rl]++;
    cascadeBuckets[cs] = (cascadeBuckets[cs] ?? 0) + 1;
    patternBuckets[sp] = (patternBuckets[sp] ?? 0) + 1;
  }

  // ── Structural Intervention Engine™ — run for each assessed leader ──
  const orgLeaderScores = assessed.map(l => ({
    name:        l.name as string,
    role_level:  l.role_level as string,
    risk_score:  (l.risk_score as number) ?? 0,
    cei:         (l.cei as number) ?? 0,
    lli_norm:    (l.lli_norm as number) ?? 0,
    lsi:         (l.lsi as number) ?? 0,
  }));

  const leaderInterventions = assessed.map(l => {
    const scores = {
      stress_regulation:     l.stress_regulation as number,
      cognitive_breadth:     l.cognitive_breadth as number,
      trust_climate:         l.trust_climate as number,
      ethical_integrity:     l.ethical_integrity as number,
      leadership_durability: l.leadership_durability as number,
      adaptive_capacity:     l.adaptive_capacity as number,
      lsi:                   l.lsi as number,
      lsi_norm:              (l.lsi_norm as number) ?? ((l.lsi as number) / 5),
      domain_variance:       (l.domain_variance as number) ?? 0,
      signal_pattern:        l.signal_pattern as any,
      lli_raw:               (l.lli_raw as number) ?? 0,
      lli_norm:              l.lli_norm as number,
      cei:                   l.cei as number,
      cascade_stage:         l.cascade_stage as any,
      cascade_level:         (l.cascade_level as number) ?? 1,
      risk_score:            l.risk_score as number,
      risk_level:            l.risk_level as any,
      trajectory_direction:  (l.trajectory_direction as any) ?? 'Stable',
    };
    if (!scores.lsi || !scores.lli_norm || !scores.cei) return null;
    return {
      leader_id:  l.leader_id as number,
      name:       l.name as string,
      role_level: l.role_level as string,
      risk_score: l.risk_score as number,
      risk_level: l.risk_level as string,
      report:     computeInterventions(scores, [], orgLeaderScores),
    };
  }).filter(Boolean) as Array<{
    leader_id: number; name: string; role_level: string;
    risk_score: number; risk_level: string;
    report: ReturnType<typeof computeInterventions>;
  }>;

  // Aggregate intervention metrics
  const activeInterventions = leaderInterventions.filter(l => l.report.interventions.length > 0);
  const criticalCount = leaderInterventions.filter(l =>
    l.report.signals.some(s => s.urgency === 'Critical' || s.urgency === 'Acute')
  ).length;

  // ── Telemetry portfolio summary ──
  const telemetryRows = await c.env.DB.prepare(`
    SELECT l.leader_id, l.name, l.role_level,
           t.tli, t.tci, t.rpi, t.data_confidence,
           f.operational_mode, f.calibrated_risk_score, f.assessment_risk_score,
           f.divergence_pattern, f.divergence_severity, f.confidence_overall
    FROM leaders l
    LEFT JOIN telemetry_snapshots t ON t.leader_id=l.leader_id AND t.organization_id=?
      AND t.created_at=(SELECT MAX(ts2.created_at) FROM telemetry_snapshots ts2 WHERE ts2.leader_id=l.leader_id AND ts2.organization_id=?)
    LEFT JOIN fusion_results f ON f.leader_id=l.leader_id AND f.organization_id=?
      AND f.created_at=(SELECT MAX(fr2.created_at) FROM fusion_results fr2 WHERE fr2.leader_id=l.leader_id AND fr2.organization_id=?)
    WHERE l.organization_id=? AND l.system_role='leader'
    ORDER BY COALESCE(t.tli, 0) DESC
  `).bind(orgId, orgId, orgId, orgId, orgId).all();

  const telRows = (telemetryRows.results ?? []) as Array<{ leader_id: number; name: string; role_level: string; tli: number|null; tci: number|null; rpi: number|null; operational_mode: string|null; calibrated_risk_score: number|null; assessment_risk_score: number|null; divergence_pattern: string|null; divergence_severity: string|null; confidence_overall: number|null }>;
  const withTel = telRows.filter(r => r.tli !== null);
  const avgTLI = withTel.length ? parseFloat((withTel.reduce((s,r) => s + r.tli!, 0) / withTel.length).toFixed(3)) : null;
  const avgTCI = withTel.length ? parseFloat((withTel.reduce((s,r) => s + r.tci!, 0) / withTel.length).toFixed(3)) : null;
  const avgRPI = withTel.length ? parseFloat((withTel.reduce((s,r) => s + r.rpi!, 0) / withTel.length).toFixed(3)) : null;

  return c.html(orgPage(
    leaderName, leaderRole, orgRow?.name ?? 'Your Organization',
    orgRow?.industry ?? '', all, assessed,
    avgRisk, avgLSI, riskBuckets, cascadeBuckets, patternBuckets,
    totalDecisions?.cnt ?? 0, leaderInterventions, activeInterventions.length, criticalCount,
    telRows, avgTLI, avgTCI, avgRPI
  ));
});

// ── POST /org/add-leader ──
org.post('/add-leader', async (c) => {
  const orgId  = c.get('orgId');
  const leaderRole = c.get('leaderRole');
  if (leaderRole !== 'admin') return c.redirect('/org');

  const body = await c.req.parseBody();
  const name      = (body.name      as string)?.trim();
  const email     = (body.email     as string)?.toLowerCase().trim();
  const roleLevel = body.role_level as string;

  if (!name || !email) return c.redirect('/org?error=Name+and+email+required');
  const exists = await c.env.DB.prepare('SELECT leader_id FROM leaders WHERE email=?').bind(email).first();
  if (exists) return c.redirect('/org?error=Email+already+registered');

  const hash = await hashPassword('Welcome2026!');
  await c.env.DB.prepare(
    'INSERT INTO leaders (organization_id,name,email,role_level,system_role,password_hash) VALUES (?,?,?,?,?,?)'
  ).bind(orgId, name, email, roleLevel ?? 'Director', 'leader', hash).run();

  return c.redirect('/org?success=Leader+added');
});

// ── GET /org/leader/:id ── Individual leader deep dive
org.get('/leader/:id', async (c) => {
  const orgId    = c.get('orgId');
  const targetId = parseInt(c.req.param('id'));

  const leader = await c.env.DB.prepare(
    'SELECT * FROM leaders WHERE leader_id=? AND organization_id=?'
  ).bind(targetId, orgId).first<Record<string, unknown>>();
  if (!leader) return c.redirect('/org');

  const assessments = await c.env.DB.prepare(`
    SELECT a.assessment_id, a.completed_at,
           rs.lsi, rs.lsi_norm, rs.lli_norm, rs.cei, rs.risk_score, rs.risk_level,
           rs.cascade_stage, rs.cascade_level, rs.signal_pattern, rs.trajectory_direction,
           rs.stress_regulation, rs.cognitive_breadth, rs.trust_climate,
           rs.ethical_integrity, rs.leadership_durability, rs.adaptive_capacity
    FROM assessments a
    JOIN risk_scores rs ON rs.assessment_id = a.assessment_id
    WHERE a.leader_id=? AND a.status='completed'
    ORDER BY a.completed_at DESC LIMIT 10
  `).bind(targetId).all<Record<string, unknown>>();

  return c.html(leaderDetailPage(leader, assessments.results ?? []));
});

// ─────────────────────────────────────────────
// ORG PAGE TEMPLATE — COMPLETE v3.1
// ─────────────────────────────────────────────

function orgPage(
  adminName: string,
  adminRole: string,
  orgName: string,
  industry: string,
  all: Record<string, unknown>[],
  assessed: Record<string, unknown>[],
  avgRisk: number | null,
  avgLSI: number | null,
  riskBuckets: Record<string, number>,
  cascadeBuckets: Record<string, number>,
  patternBuckets: Record<string, number>,
  totalOrgDecisions: number,
  leaderInterventions: Array<{ leader_id: number; name: string; role_level: string; risk_score: number; risk_level: string; report: ReturnType<typeof computeInterventions> }> = [],
  activeInterventionCount: number = 0,
  criticalCount: number = 0,
  telRows: Array<{ leader_id: number; name: string; role_level: string; tli: number|null; tci: number|null; rpi: number|null; operational_mode: string|null; calibrated_risk_score: number|null; assessment_risk_score: number|null; divergence_pattern: string|null; divergence_severity: string|null; confidence_overall: number|null }> = [],
  avgTLI: number | null = null,
  avgTCI: number | null = null,
  avgRPI: number | null = null
): string {

  const rColors: Record<string, string> = {
    'Low Structural Risk': '#10B981', 'Early Exposure': '#84CC16',
    'Emerging Dependency': '#F59E0B', 'Structural Bottleneck': '#F97316',
    'Organizational Drag': '#EF4444',
  };
  const cColors: Record<string, string> = {
    'Healthy Distribution': '#10B981', 'Early Exposure': '#84CC16',
    'Emerging Dependency': '#F59E0B', 'Structural Bottleneck': '#F97316',
    'Organizational Drag': '#EF4444',
  };
  const atRisk = (riskBuckets['Structural Bottleneck'] ?? 0) + (riskBuckets['Organizational Drag'] ?? 0);
  const errorParam = '';

  // ── Portfolio Risk Distribution percentages
  const totalAssessed = assessed.length;
  const riskPct = Object.entries(riskBuckets).map(([level, count]) => ({
    level, count,
    pct: totalAssessed > 0 ? Math.round((count / totalAssessed) * 100) : 0,
    color: rColors[level] ?? '#CBD5E1',
  }));

  // ── Gravity Map nodes (Decision routing visualization)
  // For each assessed leader: show CEI × decisions as node size
  const gravityNodes = assessed.map(l => ({
    id:    l.leader_id as number,
    name:  (l.name as string).split(' ')[0],
    role:  l.role_level as string,
    cei:   (l.cei as number) ?? 0,
    risk:  (l.risk_score as number) ?? 0,
    lli:   (l.lli_norm as number) ?? 0,
    decisions: (l.decisions_30d as number) ?? 0,
    color: rColors[l.risk_level as string] ?? '#CBD5E1',
    pattern: l.signal_pattern as string,
  }));

  // ── Org Risk Heatmap — leaders by role level
  const roleOrder = ['C-Suite / Founder', 'VP / SVP', 'Director', 'Senior Manager', 'Manager'];
  const byRole = roleOrder.map(role => ({
    role,
    leaders: all.filter(l => l.role_level === role),
  })).filter(g => g.leaders.length > 0);

  // ── Domain averages
  const domainAverages = DOMAIN_KEYS.map(k => {
    const vals = assessed.map(l => l[k] as number).filter(Boolean);
    return { key: k, avg: vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
  });

  // ── Decision velocity
  const totalLeaderDecisions = assessed.reduce((s, l) => s + ((l.decisions_30d as number) ?? 0), 0);
  const velocityPerLeader = totalOrgDecisions > 0 && assessed.length > 0
    ? (totalOrgDecisions / assessed.length).toFixed(1) : '—';

  // ── Leader rows
  const leaderRows = all.map(l => {
    const rs      = l.risk_score as number | null;
    const rColor  = rs != null ? (rColors[l.risk_level as string] ?? '#6B7280') : '#CBD5E1';
    const initials = (l.name as string).split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
    const date = l.completed_at
      ? new Date(l.completed_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
    const lsi_norm = (l.lsi_norm as number) ?? ((l.lsi as number) ? (l.lsi as number) / 5 : null);

    return `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="px-4 py-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style="background:${rColor}22;color:${rColor}">${initials}</div>
          <div>
            <a href="/org/leader/${l.leader_id}" class="text-sm font-semibold text-slate-800 hover:text-indigo-600">${l.name}</a>
            <p class="text-xs text-slate-400">${l.role_level ?? ''}</p>
          </div>
        </div>
      </td>
      <td class="px-4 py-3">
        ${rs != null ? `<span class="text-base font-black" style="color:${rColor}">${rs.toFixed(3)}</span>` : '<span class="text-xs text-slate-400">—</span>'}
      </td>
      <td class="px-4 py-3"><span class="text-xs font-medium" style="color:${rColor}">${rs != null ? l.risk_level : '—'}</span></td>
      <td class="px-4 py-3"><span class="text-xs" style="color:${l.cascade_stage ? (cColors[l.cascade_stage as string] ?? '#6B7280') : '#CBD5E1'}">${l.cascade_stage ?? '—'}</span></td>
      <td class="px-4 py-3">
        ${rs != null ? `
        <div class="text-xs text-slate-500 space-y-0.5">
          <div>LSI_norm: <span class="font-semibold text-indigo-600">${lsi_norm != null ? lsi_norm.toFixed(2) : '—'}</span></div>
          <div>LLI: <span class="font-semibold text-amber-600">${(l.lli_norm as number).toFixed(2)}</span> · CEI: <span class="font-semibold text-orange-600">${(l.cei as number).toFixed(2)}</span></div>
        </div>` : '<span class="text-xs text-slate-400">Not assessed</span>'}
      </td>
      <td class="px-4 py-3 text-xs text-slate-400">${date}</td>
      <td class="px-4 py-3">
        <a href="/org/leader/${l.leader_id}" class="text-xs text-indigo-600 hover:underline">Details</a>
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Organization Dashboard — LRI™</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    .gravity-node { transition: all 0.3s; cursor: pointer; }
    .gravity-node:hover { transform: scale(1.08); filter: brightness(1.1); }
    .risk-cell { border-radius: 6px; padding: 3px 7px; text-align:center; font-size:11px; font-weight:700; }
  </style>
</head>
<body class="bg-slate-50">
<nav class="bg-white border-b border-slate-200 sticky top-0 z-10">
  <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
        <i class="fas fa-chart-line text-white text-sm"></i>
      </div>
      <span class="font-bold text-slate-900 text-sm">Leadership Risk Intelligence™</span>
      <span class="text-slate-300 mx-1">·</span>
      <span class="text-sm text-slate-600">${orgName}</span>
    </div>
    <div class="flex items-center gap-4">
      <a href="/dashboard" class="text-xs text-slate-400 hover:text-slate-700">My Dashboard</a>
      <a href="/api/docs" class="text-xs text-slate-400 hover:text-slate-700">API</a>
      <span class="text-xs text-slate-500">${adminName}</span>
      <a href="/logout" class="text-xs text-slate-400 hover:text-red-600"><i class="fas fa-sign-out-alt"></i></a>
    </div>
  </div>
</nav>

<div class="max-w-7xl mx-auto px-4 py-7 space-y-6">

  <!-- ═══ HEADER ═══ -->
  <div class="flex items-start justify-between flex-wrap gap-3">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Organization Intelligence View</h1>
      <p class="text-slate-500 text-sm mt-0.5">${orgName} · ${industry} · ${all.length} leaders tracked</p>
      <p class="text-xs text-indigo-500 mt-1 font-medium">v3.1 · Risk Score = (CEI × LLI_norm) / LSI_norm · Cascade driven by Risk Score</p>
    </div>
    ${adminRole === 'admin' ? `
    <button onclick="document.getElementById('addModal').classList.remove('hidden')"
      class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
      <i class="fas fa-user-plus"></i> Add Leader
    </button>` : ''}
  </div>

  <!-- ═══ KPI ROW ═══ -->
  <div class="grid grid-cols-2 md:grid-cols-7 gap-4">
    <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <p class="text-xs text-slate-400 mb-1">Total Leaders</p>
      <p class="text-2xl font-black text-slate-900">${all.length}</p>
    </div>
    <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <p class="text-xs text-slate-400 mb-1">Assessed</p>
      <p class="text-2xl font-black text-slate-900">${assessed.length}</p>
    </div>
    <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <p class="text-xs text-slate-400 mb-1">Avg Risk Score™</p>
      <p class="text-2xl font-black" style="color:${avgRisk != null ? (avgRisk > 0.15 ? '#EF4444' : avgRisk > 0.08 ? '#F97316' : '#10B981') : '#CBD5E1'}">${avgRisk != null ? avgRisk.toFixed(3) : '—'}</p>
    </div>
    <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <p class="text-xs text-slate-400 mb-1">Avg LSI™</p>
      <p class="text-2xl font-black text-indigo-600">${avgLSI != null ? avgLSI.toFixed(2) : '—'}</p>
    </div>
    <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <p class="text-xs text-slate-400 mb-1">At Risk (Structural+)</p>
      <p class="text-2xl font-black text-red-600">${atRisk}</p>
    </div>
    <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <p class="text-xs text-slate-400 mb-1">Org Decisions / 30d</p>
      <p class="text-2xl font-black text-slate-700">${totalOrgDecisions || '—'}</p>
    </div>
    <div class="bg-white rounded-xl border ${activeInterventionCount > 0 ? 'border-amber-300' : 'border-slate-200'} p-4 shadow-sm">
      <p class="text-xs text-slate-400 mb-1">Active Interventions</p>
      <p class="text-2xl font-black ${activeInterventionCount > 0 ? 'text-amber-600' : 'text-slate-400'}">${activeInterventionCount}</p>
    </div>
    <div class="bg-white rounded-xl border ${criticalCount > 0 ? 'border-red-300' : 'border-slate-200'} p-4 shadow-sm">
      <p class="text-xs text-slate-400 mb-1">Critical / Acute</p>
      <p class="text-2xl font-black ${criticalCount > 0 ? 'text-red-600' : 'text-slate-400'}">${criticalCount}</p>
    </div>
  </div>

  <!-- ═══ STRUCTURAL INTERVENTION ENGINE™ — PORTFOLIO VIEW ═══ -->
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between" style="${activeInterventionCount > 0 ? 'background:linear-gradient(135deg,#FFF7ED,#FEF2F2)' : ''}">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background:${activeInterventionCount > 0 ? '#F9731622' : '#E2E8F0'}">
          <i class="fas fa-brain text-sm" style="color:${activeInterventionCount > 0 ? '#F97316' : '#94A3B8'}"></i>
        </div>
        <div>
          <p class="text-sm font-bold text-slate-800">Structural Intervention Engine™</p>
          <p class="text-xs text-slate-500">Predictive failure pattern detection · ${activeInterventionCount} leader${activeInterventionCount !== 1 ? 's' : ''} require${activeInterventionCount === 1 ? 's' : ''} intervention</p>
        </div>
      </div>
      ${criticalCount > 0 ? `
      <div class="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
        <i class="fas fa-radiation text-red-600 text-sm"></i>
        <span class="text-xs font-bold text-red-700">${criticalCount} Critical</span>
      </div>` : ''}
    </div>
    <div class="p-5">
      ${renderOrgInterventionSummary(leaderInterventions)}
    </div>
  </div>

  <!-- ═══ STRUCTURAL TELEMETRY LAYER™ — PORTFOLIO VIEW ═══ -->
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-violet-600 rounded-xl flex items-center justify-center">
          <i class="fas fa-satellite-dish text-white text-sm"></i>
        </div>
        <div>
          <h2 class="text-sm font-bold text-slate-800">Structural Telemetry Layer™</h2>
          <p class="text-xs text-slate-400">Optional operational metadata calibration · enterprise connectors</p>
        </div>
      </div>
      <span class="text-xs text-slate-400">${telRows.filter(r => r.tli !== null).length} of ${telRows.length} leaders connected</span>
    </div>
    <div class="p-5">
      ${renderOrgTelemetrySummary(telRows, avgTLI, avgTCI, avgRPI)}
    </div>
  </div>

  <!-- ═══ DECISION GRAVITY MAP + PORTFOLIO RISK DISTRIBUTION ═══ -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

    <!-- DECISION GRAVITY MAP -->
    <div class="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div class="flex items-start justify-between mb-1">
        <div>
          <p class="text-sm font-bold text-slate-800">Decision Gravity Map™</p>
          <p class="text-xs text-slate-500 mt-0.5">Node size = decision concentration (CEI). Color = risk level. Arrows show routing toward concentration.</p>
        </div>
        <span class="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">30-day window</span>
      </div>
      <div class="relative mt-4" style="height:320px;">
        <canvas id="gravityCanvas" class="absolute inset-0 w-full h-full"></canvas>
      </div>
      <!-- Legend -->
      <div class="mt-3 flex flex-wrap gap-3 text-xs">
        ${[
          { color: '#10B981', label: 'Low Structural Risk' },
          { color: '#84CC16', label: 'Early Exposure' },
          { color: '#F59E0B', label: 'Emerging Dependency' },
          { color: '#F97316', label: 'Structural Bottleneck' },
          { color: '#EF4444', label: 'Organizational Drag' },
        ].map(l => `
        <div class="flex items-center gap-1.5">
          <div class="w-3 h-3 rounded-full" style="background:${l.color}"></div>
          <span class="text-slate-500">${l.label}</span>
        </div>`).join('')}
      </div>
    </div>

    <!-- PORTFOLIO RISK DISTRIBUTION -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <p class="text-sm font-bold text-slate-800 mb-1">Portfolio Risk Distribution</p>
      <p class="text-xs text-slate-400 mb-4">Across ${totalAssessed} assessed leaders</p>

      <!-- Stacked bar -->
      <div class="h-4 rounded-full overflow-hidden flex mb-4">
        ${riskPct.filter(r => r.count > 0).map(r => `
        <div class="h-full transition-all" style="width:${r.pct}%;background:${r.color}" title="${r.level}: ${r.count}"></div>`).join('')}
      </div>

      <div class="space-y-2.5">
        ${riskPct.map(r => `
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${r.color}"></div>
            <span class="text-xs text-slate-600">${r.level}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-800">${r.count}</span>
            <span class="text-xs text-slate-400 w-8 text-right">${r.pct}%</span>
          </div>
        </div>`).join('')}
      </div>

      <div class="mt-5 pt-4 border-t border-slate-100">
        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Signal Pattern Mix</p>
        ${Object.entries(patternBuckets).map(([p, cnt]) => {
          const meta = SIGNAL_PATTERN_META[p as keyof typeof SIGNAL_PATTERN_META];
          return `
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-1.5">
              <i class="fas fa-${meta?.icon ?? 'circle'} text-xs" style="color:${meta?.color ?? '#CBD5E1'}"></i>
              <span class="text-xs text-slate-600">${p}</span>
            </div>
            <span class="text-xs font-bold" style="color:${meta?.color ?? '#6B7280'}">${cnt}</span>
          </div>`;
        }).join('')}
      </div>
    </div>

  </div>

  <!-- ═══ ORGANIZATIONAL RISK HEATMAP ═══ -->
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
    <div class="flex items-start justify-between mb-5">
      <div>
        <p class="text-sm font-bold text-slate-800">Organizational Risk Heatmap™</p>
        <p class="text-xs text-slate-500 mt-0.5">Leadership risk across organizational layers — board-level intelligence view</p>
      </div>
      <div class="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 space-y-1">
        <div class="flex items-center gap-2"><div class="w-4 h-3 rounded bg-green-400"></div><span>Low / Early</span></div>
        <div class="flex items-center gap-2"><div class="w-4 h-3 rounded bg-amber-400"></div><span>Emerging</span></div>
        <div class="flex items-center gap-2"><div class="w-4 h-3 rounded bg-red-400"></div><span>Bottleneck / Drag</span></div>
        <div class="flex items-center gap-2"><div class="w-4 h-3 rounded bg-slate-200"></div><span>Not assessed</span></div>
      </div>
    </div>
    <div class="space-y-4">
      ${byRole.map(group => `
      <div>
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">${group.role}</p>
        <div class="flex flex-wrap gap-2">
          ${group.leaders.map(l => {
            const rs = l.risk_score as number | null;
            let bg = '#F1F5F9'; let text = '#64748B'; let border = '#E2E8F0';
            if (rs != null) {
              if (rs <= 0.030) { bg = '#D1FAE5'; text = '#065F46'; border = '#6EE7B7'; }
              else if (rs <= 0.080) { bg = '#ECFCCB'; text = '#365314'; border = '#A3E635'; }
              else if (rs <= 0.150) { bg = '#FEF3C7'; text = '#78350F'; border = '#FCD34D'; }
              else if (rs <= 0.300) { bg = '#FFEDD5'; text = '#7C2D12'; border = '#FB923C'; }
              else { bg = '#FEE2E2'; text = '#7F1D1D'; border = '#F87171'; }
            }
            return `
            <a href="/org/leader/${l.leader_id}" class="group relative">
              <div class="px-3 py-2 rounded-lg border transition-all hover:shadow-md"
                style="background:${bg};border-color:${border}">
                <p class="text-xs font-bold" style="color:${text}">${l.name as string}</p>
                <p class="text-xs mt-0.5" style="color:${text}88">${rs != null ? rs.toFixed(3) : 'Pending'}</p>
                ${rs != null ? `<p class="text-xs mt-0.5 font-medium" style="color:${text}">${l.risk_level as string}</p>` : ''}
              </div>
              <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 w-48 bg-slate-900 text-white text-xs rounded-lg p-2.5 shadow-xl">
                <p class="font-bold mb-1">${l.name as string}</p>
                <p class="text-slate-400">${l.role_level as string}</p>
                ${rs != null ? `
                <div class="mt-1.5 space-y-0.5 text-slate-300">
                  <p>LSI: ${(l.lsi as number).toFixed(2)} · LLI: ${(l.lli_norm as number).toFixed(2)}</p>
                  <p>CEI: ${(l.cei as number).toFixed(2)} · Risk: ${rs.toFixed(3)}</p>
                  <p class="font-semibold" style="color:${rColors[l.risk_level as string] ?? '#CBD5E1'}">${l.signal_pattern as string}</p>
                </div>` : '<p class="text-slate-500 mt-1">No assessment yet</p>'}
              </div>
            </a>`;
          }).join('')}
        </div>
      </div>`).join('')}
    </div>
  </div>

  <!-- ═══ CHARTS ROW: CASCADE + DOMAIN HEATMAP + VELOCITY ═══ -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-5">

    <!-- Cascade Distribution -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <p class="text-sm font-bold text-slate-800 mb-1">Leadership Cost Cascade™</p>
      <p class="text-xs text-slate-400 mb-4">Classified by Risk Score (v3.1)</p>
      <div class="space-y-2">
        ${CASCADE_STAGES.map(s => {
          const count = cascadeBuckets[s.stage] ?? 0;
          const pct   = totalAssessed > 0 ? Math.round((count / totalAssessed) * 100) : 0;
          return `
          <div>
            <div class="flex items-center justify-between mb-0.5">
              <span class="text-xs text-slate-600">${s.stage}</span>
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-slate-700">${count}</span>
                <span class="text-xs text-slate-400 w-8 text-right">${pct}%</span>
              </div>
            </div>
            <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full rounded-full" style="width:${pct}%;background:${s.color}"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Domain Signal Heatmap -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <p class="text-sm font-bold text-slate-800 mb-3">Domain Signal Distribution</p>
      <div class="space-y-3">
        ${domainAverages.map(d => {
          const meta = DOMAIN_META.find(dm => dm.key === d.key)!;
          const avg  = d.avg;
          const pct  = avg != null ? Math.round(((avg - 1) / 4) * 100) : 0;
          const heatColor = avg != null
            ? (avg >= 4.0 ? '#10B981' : avg >= 3.0 ? '#F59E0B' : '#EF4444') : '#CBD5E1';
          return `
          <div>
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-1.5">
                <div class="w-2 h-2 rounded-full" style="background:${meta.color}"></div>
                <span class="text-xs text-slate-600">${meta.shortLabel}</span>
              </div>
              <span class="text-xs font-bold" style="color:${heatColor}">${avg != null ? avg.toFixed(2) : '—'}</span>
            </div>
            <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full rounded-full" style="width:${pct}%;background:${heatColor}"></div>
            </div>
          </div>`;
        }).join('')}
        ${avgLSI != null ? `
        <div class="pt-2 border-t border-slate-100 flex justify-between items-center">
          <span class="text-xs font-semibold text-slate-600">LSI™ Average</span>
          <div class="text-right">
            <span class="text-sm font-black text-indigo-600">${avgLSI.toFixed(2)}</span>
            <span class="text-xs text-indigo-400 ml-1">/ 5.0</span>
          </div>
        </div>` : ''}
      </div>
    </div>

    <!-- Decision Velocity Panel -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <p class="text-sm font-bold text-slate-800 mb-1">Decision Velocity™</p>
      <p class="text-xs text-slate-400 mb-4">When concentration ↑, velocity ↓</p>
      <div class="space-y-4">
        <div class="text-center py-3 bg-slate-50 rounded-xl">
          <p class="text-3xl font-black text-slate-800">${totalOrgDecisions || 0}</p>
          <p class="text-xs text-slate-500 mt-1">Total decisions / 30 days</p>
        </div>
        <div class="text-center py-3 bg-indigo-50 rounded-xl">
          <p class="text-3xl font-black text-indigo-600">${velocityPerLeader}</p>
          <p class="text-xs text-slate-500 mt-1">Avg decisions per assessed leader</p>
        </div>
        ${assessed.filter(l => (l.cei as number) > 0).length > 0 ? `
        <div>
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Top Concentration Points</p>
          ${[...assessed].sort((a, b) => (b.cei as number) - (a.cei as number)).slice(0, 3).map(l => `
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-slate-700 truncate max-w-[120px]">${(l.name as string).split(' ')[0]}</span>
            <div class="flex items-center gap-2">
              <div class="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full rounded-full" style="width:${Math.round((l.cei as number)*100)}%;background:${rColors[l.risk_level as string] ?? '#CBD5E1'}"></div>
              </div>
              <span class="text-xs font-bold w-8 text-right" style="color:${rColors[l.risk_level as string] ?? '#6B7280'}">${Math.round((l.cei as number)*100)}%</span>
            </div>
          </div>`).join('')}
        </div>` : ''}
      </div>
    </div>

  </div>

  <!-- ═══ LEADERSHIP RISK MAP TABLE ═══ -->
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
      <h2 class="text-sm font-bold text-slate-800">Leadership Risk Map</h2>
      <span class="text-xs text-slate-400">Sorted by risk score · v3.1 formula</span>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-slate-100 bg-slate-50">
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Leader</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Risk Score™</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Risk Level</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Cascade Stage</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">LSI_norm · LLI · CEI</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Last</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${leaderRows || `<tr><td colspan="7" class="px-4 py-10 text-center text-sm text-slate-400">No leaders yet.</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>

</div>

<!-- Add Leader Modal -->
${adminRole === 'admin' ? `
<div id="addModal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
    <div class="flex items-center justify-between mb-5">
      <h3 class="font-bold text-slate-900">Add Leader to Portfolio</h3>
      <button onclick="document.getElementById('addModal').classList.add('hidden')" class="text-slate-400 hover:text-slate-600"><i class="fas fa-times"></i></button>
    </div>
    <form method="POST" action="/org/add-leader" class="space-y-4">
      <div>
        <label class="text-xs font-medium text-slate-700 block mb-1.5">Full name</label>
        <input type="text" name="name" required class="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Jane Smith">
      </div>
      <div>
        <label class="text-xs font-medium text-slate-700 block mb-1.5">Email</label>
        <input type="email" name="email" required class="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="jane@company.com">
      </div>
      <div>
        <label class="text-xs font-medium text-slate-700 block mb-1.5">Role level</label>
        <select name="role_level" class="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500">
          <option>C-Suite / Founder</option><option>VP / SVP</option>
          <option>Director</option><option>Senior Manager</option><option>Manager</option>
        </select>
      </div>
      <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
        <i class="fas fa-info-circle mr-1"></i>Default password: <strong>Welcome2026!</strong>
      </div>
      <div class="flex gap-3">
        <button type="button" onclick="document.getElementById('addModal').classList.add('hidden')" class="flex-1 border border-slate-300 text-slate-600 font-medium py-2.5 rounded-xl text-sm">Cancel</button>
        <button type="submit" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl text-sm">Add Leader</button>
      </div>
    </form>
  </div>
</div>` : ''}

<script>
// ═══════════════════════════════════════════════
// DECISION GRAVITY MAP — Canvas Network Visualization
// ═══════════════════════════════════════════════
const gravityNodes = ${JSON.stringify(gravityNodes)};
const canvas = document.getElementById('gravityCanvas');
if (canvas && gravityNodes.length > 0) {
  const ctx = canvas.getContext('2d');
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  const W = canvas.width;
  const H = canvas.height;

  // Position nodes in a layout
  const n = gravityNodes.length;
  const cx = W / 2, cy = H / 2;
  const radius = Math.min(W, H) * 0.32;

  const positions = gravityNodes.map((node, i) => {
    if (n === 1) return { x: cx, y: cy };
    const angle = (2 * Math.PI * i / n) - Math.PI / 2;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });

  // Find the highest-risk node (gravity center)
  const maxRiskIdx = gravityNodes.reduce((maxI, node, i) =>
    node.risk > gravityNodes[maxI].risk ? i : maxI, 0);

  function drawGravityMap() {
    ctx.clearRect(0, 0, W, H);

    // Draw arrows toward highest-risk node (gravity pull)
    const center = positions[maxRiskIdx];
    for (let i = 0; i < n; i++) {
      if (i === maxRiskIdx) continue;
      const from = positions[i];
      const node = gravityNodes[i];
      const opacity = 0.15 + node.cei * 0.4;

      // Arrow line
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(center.x, center.y);
      ctx.strokeStyle = \`rgba(148,163,184,\${opacity})\`;
      ctx.lineWidth = 1 + node.cei * 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrowhead
      const angle = Math.atan2(center.y - from.y, center.x - from.x);
      const dist  = Math.hypot(center.x - from.x, center.y - from.y);
      const arrowX = from.x + (dist - 28) * Math.cos(angle);
      const arrowY = from.y + (dist - 28) * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX - 10 * Math.cos(angle - 0.4), arrowY - 10 * Math.sin(angle - 0.4));
      ctx.lineTo(arrowX - 10 * Math.cos(angle + 0.4), arrowY - 10 * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fillStyle = \`rgba(148,163,184,\${opacity + 0.1})\`;
      ctx.fill();
    }

    // Draw nodes
    for (let i = 0; i < n; i++) {
      const pos  = positions[i];
      const node = gravityNodes[i];
      const nodeRadius = 18 + node.cei * 28;  // Size = CEI magnitude

      // Outer glow for high risk
      if (node.risk > 0.10) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius + 6, 0, 2 * Math.PI);
        ctx.fillStyle = node.color + '22';
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = node.color + 'CC';
      ctx.fill();
      ctx.strokeStyle = node.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Initials
      const initials = node.name.substring(0, 2).toUpperCase();
      ctx.fillStyle = 'white';
      ctx.font = \`bold \${Math.round(nodeRadius * 0.55)}px Inter,sans-serif\`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials, pos.x, pos.y);

      // Name label below
      ctx.fillStyle = '#334155';
      ctx.font = '11px Inter,sans-serif';
      ctx.fillText(node.name, pos.x, pos.y + nodeRadius + 14);

      // Risk score below name
      ctx.fillStyle = node.color;
      ctx.font = 'bold 10px Inter,sans-serif';
      ctx.fillText(node.risk.toFixed(3), pos.x, pos.y + nodeRadius + 26);
    }

    // Central label if multiple nodes
    if (n > 1) {
      const highestNode = gravityNodes[maxRiskIdx];
      if (highestNode.risk > 0.08) {
        ctx.fillStyle = '#94A3B8';
        ctx.font = '10px Inter,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('↑ Gravity Point', positions[maxRiskIdx].x, positions[maxRiskIdx].y - 32 - 14);
      }
    }
  }

  drawGravityMap();

  // Resize handler
  window.addEventListener('resize', () => {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    drawGravityMap();
  });
}

// Portfolio Risk Distribution doughnut
const rDistCtx = document.getElementById('riskDistChart')?.getContext('2d');
if (rDistCtx) {
  new Chart(rDistCtx, {
    type: 'doughnut',
    data: {
      labels: ${JSON.stringify(Object.keys(riskBuckets))},
      datasets: [{
        data: ${JSON.stringify(Object.values(riskBuckets))},
        backgroundColor: ${JSON.stringify(Object.keys(riskBuckets).map(k => ({
          'Low Structural Risk': '#10B981', 'Early Exposure': '#84CC16',
          'Emerging Dependency': '#F59E0B', 'Structural Bottleneck': '#F97316',
          'Organizational Drag': '#EF4444',
        }[k] ?? '#CBD5E1')))},
        borderWidth: 0,
      }]
    },
    options: { responsive: true, cutout: '60%', plugins: { legend: { display: false } } }
  });
}
</script>
</body></html>`;
}

// ─────────────────────────────────────────────
// LEADER DETAIL PAGE
// ─────────────────────────────────────────────
function leaderDetailPage(leader: Record<string, unknown>, assessments: Record<string, unknown>[]): string {
  const latest = assessments[0];
  const rColors: Record<string, string> = {
    'Low Structural Risk': '#10B981', 'Early Exposure': '#84CC16',
    'Emerging Dependency': '#F59E0B', 'Structural Bottleneck': '#F97316',
    'Organizational Drag': '#EF4444',
  };

  const histRows = assessments.map((a, i) => {
    const rColor  = rColors[a.risk_level as string] ?? '#6B7280';
    const date    = new Date(a.completed_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const lsi_norm = (a.lsi_norm as number) ?? ((a.lsi as number) / 5);
    return `
    <tr class="${i === 0 ? 'bg-indigo-50/40' : 'hover:bg-slate-50'} transition-colors">
      <td class="px-4 py-3 text-sm text-slate-600">${date}</td>
      <td class="px-4 py-3 text-sm font-black" style="color:${rColor}">${(a.risk_score as number).toFixed(3)}</td>
      <td class="px-4 py-3 text-xs font-medium" style="color:${rColor}">${a.risk_level}</td>
      <td class="px-4 py-3 text-xs text-slate-500">${a.cascade_stage}</td>
      <td class="px-4 py-3 text-xs text-slate-500">
        LSI: ${(a.lsi as number).toFixed(2)} (norm: ${lsi_norm.toFixed(2)}) ·
        LLI: ${(a.lli_norm as number).toFixed(2)} · CEI: ${((a.cei as number)*100).toFixed(0)}%
      </td>
      <td class="px-4 py-3">
        <a href="/assessment/${a.assessment_id}/brief" class="text-xs text-indigo-600 hover:underline font-medium">View Brief</a>
      </td>
    </tr>`;
  }).join('');

  const rColor   = latest ? (rColors[latest.risk_level as string] ?? '#6B7280') : '#6B7280';
  const chartData = [...assessments].reverse();
  const lsi_norm  = latest ? ((latest.lsi_norm as number) ?? ((latest.lsi as number) / 5)) : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${leader.name} — LRI™</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body class="bg-slate-50">
<nav class="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-3">
  <div class="max-w-5xl mx-auto flex items-center gap-3">
    <a href="/org" class="text-slate-400 hover:text-slate-600 text-sm"><i class="fas fa-arrow-left mr-1"></i>Portfolio</a>
    <span class="text-slate-300">/</span>
    <span class="text-sm font-semibold text-slate-800">${leader.name}</span>
  </div>
</nav>
<div class="max-w-5xl mx-auto px-4 py-7 space-y-5">

  <!-- Header card -->
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
    <div class="flex items-start justify-between flex-wrap gap-4">
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl" style="background:${rColor}">
          ${(leader.name as string).split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 class="text-xl font-bold text-slate-900">${leader.name}</h1>
          <p class="text-sm text-slate-500">${leader.email} · ${leader.role_level}</p>
          <p class="text-xs text-slate-400 mt-0.5">Leader since ${new Date(leader.created_at as string).toLocaleDateString()}</p>
        </div>
      </div>
      ${latest ? `
      <div class="text-right">
        <p class="text-3xl font-black" style="color:${rColor}">${(latest.risk_score as number).toFixed(3)}</p>
        <p class="text-xs font-semibold mt-0.5" style="color:${rColor}">${latest.risk_level}</p>
        <p class="text-xs text-slate-400 mt-1">${latest.cascade_stage}</p>
        <p class="text-xs text-slate-500 mt-1">LSI_norm: ${lsi_norm.toFixed(3)} · LLI: ${(latest.lli_norm as number).toFixed(2)} · CEI: ${((latest.cei as number)*100).toFixed(0)}%</p>
        <a href="/assessment/${latest.assessment_id}/brief"
          class="inline-flex items-center gap-1.5 mt-2 text-xs text-indigo-600 hover:text-indigo-700 font-semibold">
          <i class="fas fa-file-alt"></i> View Executive Brief
        </a>
      </div>` : ''}
    </div>
  </div>

  ${chartData.length > 1 ? `
  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <p class="text-sm font-bold text-slate-800 mb-3">Risk Score™ Trajectory</p>
      <canvas id="riskTrend" height="100"></canvas>
    </div>
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <p class="text-sm font-bold text-slate-800 mb-3">Signal Radar (Latest)</p>
      <canvas id="radar" height="100"></canvas>
    </div>
  </div>` : `
  ${latest ? `
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
    <p class="text-sm font-bold text-slate-800 mb-3">Signal Radar</p>
    <div class="max-w-xs mx-auto"><canvas id="radar" height="220"></canvas></div>
  </div>` : ''}`}

  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
      <h3 class="text-sm font-bold text-slate-800">Assessment History</h3>
      <span class="text-xs text-slate-400">v3.1 · (CEI × LLI_norm) / LSI_norm</span>
    </div>
    <table class="w-full">
      <thead><tr class="border-b border-slate-100 bg-slate-50">
        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Date</th>
        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Risk Score™</th>
        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Risk Level</th>
        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Cascade Stage</th>
        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Indices</th>
        <th class="px-4 py-3"></th>
      </tr></thead>
      <tbody class="divide-y divide-slate-100">
        ${histRows || '<tr><td colspan="6" class="px-4 py-8 text-center text-sm text-slate-400">No assessments</td></tr>'}
      </tbody>
    </table>
  </div>
</div>
<script>
${chartData.length > 1 ? `
const rt = document.getElementById('riskTrend')?.getContext('2d');
if (rt) new Chart(rt, {
  type: 'line',
  data: {
    labels: ${JSON.stringify(chartData.map(a => new Date(a.completed_at as string).toLocaleDateString('en-US', {month:'short',day:'numeric'})))},
    datasets: [{ data: ${JSON.stringify(chartData.map(a => (a.risk_score as number).toFixed(4)))},
      borderColor:'${rColor}', backgroundColor:'${rColor}20', borderWidth:2, pointRadius:4, fill:true, tension:0.3 }]
  },
  options: { responsive:true, plugins:{legend:{display:false}}, scales:{y:{min:0,grid:{color:'#F1F5F9'}},x:{grid:{display:false}}} }
});` : ''}
${latest ? `
const rr = document.getElementById('radar')?.getContext('2d');
if (rr) new Chart(rr, {
  type: 'radar',
  data: {
    labels: ['Stress\\nReg.','Cognitive\\nBreadth','Trust\\nClimate','Ethical\\nIntegrity','Durability','Adaptive\\nCap.'],
    datasets: [{ data: [${DOMAIN_KEYS.map(k => (latest[k] as number ?? 0).toFixed(2)).join(',')}],
      backgroundColor:'${rColor}20', borderColor:'${rColor}', borderWidth:2, pointBackgroundColor:'${rColor}', pointRadius:3 }]
  },
  options: { responsive:true, scales:{r:{min:0,max:5,ticks:{stepSize:1,font:{size:8}},grid:{color:'#E2E8F0'},pointLabels:{font:{size:8}}}}, plugins:{legend:{display:false}} }
});` : ''}
</script>
</body></html>`;
}

export default org;
