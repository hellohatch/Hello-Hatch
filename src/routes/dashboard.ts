// Leader Dashboard — Personal Intelligence View (v3.2 — Structural Intervention Engine™)

import { Hono } from 'hono';
import type { Bindings, Variables } from '../types/index.js';
import { requireAuth } from '../lib/auth.js';
import { RISK_LEVELS, CASCADE_STAGES, SIGNAL_PATTERN_META } from '../lib/scoring.js';
import { DOMAIN_META, DOMAIN_KEYS } from '../lib/questions.js';
import { computeInterventions } from '../lib/interventions.js';
import { renderInterventionPanel } from '../lib/interventionUI.js';

const dashboard = new Hono<{ Bindings: Bindings; Variables: Variables }>();
dashboard.use('*', requireAuth);

dashboard.get('/', async (c) => {
  const leaderId   = c.get('leaderId');
  const leaderName = c.get('leaderName');
  const orgId      = c.get('orgId');

  // Latest completed assessment
  const latest = await c.env.DB.prepare(`
    SELECT a.assessment_id, a.completed_at, rs.*
    FROM assessments a
    JOIN risk_scores rs ON rs.assessment_id = a.assessment_id
    WHERE a.leader_id = ? AND a.status = 'completed'
    ORDER BY a.completed_at DESC LIMIT 1
  `).bind(leaderId).first<Record<string, unknown>>();

  // Assessment history (last 8)
  const history = await c.env.DB.prepare(`
    SELECT a.assessment_id, a.completed_at,
           rs.lsi, rs.lli_norm, rs.cei, rs.risk_score, rs.risk_level,
           rs.cascade_stage, rs.cascade_level, rs.signal_pattern, rs.trajectory_direction
    FROM assessments a
    JOIN risk_scores rs ON rs.assessment_id = a.assessment_id
    WHERE a.leader_id = ? AND a.status = 'completed'
    ORDER BY a.completed_at DESC LIMIT 8
  `).bind(leaderId).all<Record<string, unknown>>();

  // In-progress assessment
  const inProg = await c.env.DB.prepare(
    'SELECT assessment_id FROM assessments WHERE leader_id=? AND status=? LIMIT 1'
  ).bind(leaderId, 'in_progress').first<{ assessment_id: number }>();

  // Decision velocity — decisions resolved by this leader in last 30 days
  const decisionData = await c.env.DB.prepare(`
    SELECT
      COUNT(*) as decisions_30d,
      COUNT(DISTINCT date(timestamp)) as active_days,
      (SELECT COUNT(*) FROM decision_events WHERE organization_id=? AND timestamp >= datetime('now','-30 days')) as org_total_30d
    FROM decision_events
    WHERE resolved_by=? AND timestamp >= datetime('now','-30 days')
  `).bind(orgId, leaderId).first<{ decisions_30d: number; active_days: number; org_total_30d: number }>();

  const decisions30d  = decisionData?.decisions_30d  ?? 0;
  const orgTotal30d   = decisionData?.org_total_30d  ?? 0;
  const activeDays    = decisionData?.active_days    ?? 30;
  const velocity      = activeDays > 0 ? parseFloat((decisions30d / 30).toFixed(2)) : 0;
  const ceiLive       = orgTotal30d > 0 ? parseFloat((decisions30d / orgTotal30d).toFixed(3)) : null;

  // ── Structural Intervention Engine™ ──
  // Build intervention report from latest assessment scores
  const historicalScores = (history.results ?? []).map(h => h.risk_score as number).slice(1); // exclude latest
  const interventionReport = latest ? computeInterventions(
    {
      stress_regulation:     latest.stress_regulation as number,
      cognitive_breadth:     latest.cognitive_breadth as number,
      trust_climate:         latest.trust_climate as number,
      ethical_integrity:     latest.ethical_integrity as number,
      leadership_durability: latest.leadership_durability as number,
      adaptive_capacity:     latest.adaptive_capacity as number,
      lsi:                   latest.lsi as number,
      lsi_norm:              (latest.lsi_norm as number) ?? ((latest.lsi as number) / 5),
      domain_variance:       latest.domain_variance as number,
      signal_pattern:        latest.signal_pattern as any,
      lli_raw:               latest.lli_raw as number,
      lli_norm:              latest.lli_norm as number,
      cei:                   latest.cei as number,
      cascade_stage:         latest.cascade_stage as any,
      cascade_level:         latest.cascade_level as number,
      risk_score:            latest.risk_score as number,
      risk_level:            latest.risk_level as any,
      trajectory_direction:  latest.trajectory_direction as any,
    },
    historicalScores
  ) : null;

  return c.html(dashboardPage(
    leaderName, latest, history.results ?? [], inProg?.assessment_id ?? null,
    decisions30d, orgTotal30d, velocity, ceiLive,
    interventionReport
  ));
});

// ─────────────────────────────────────────────
function dashboardPage(
  name: string,
  latest: Record<string, unknown> | null,
  history: Record<string, unknown>[],
  inProgressId: number | null,
  decisions30d: number = 0,
  orgTotal30d: number = 0,
  velocity: number = 0,
  ceiLive: number | null = null,
  interventionReport: ReturnType<typeof computeInterventions> | null = null
): string {

  const riskColors: Record<string, string> = {
    'Low structural risk': '#10B981',
    'Early exposure': '#84CC16',
    'Emerging dependency': '#F59E0B',
    'Structural bottleneck': '#F97316',
    'Organizational risk': '#EF4444',
  };
  const cascadeColors: Record<string, string> = {
    'Healthy Distribution': '#10B981',
    'Emerging Exposure': '#84CC16',
    'Structural Dependency': '#F59E0B',
    'Decision Bottleneck': '#F97316',
    'Organizational Drag': '#EF4444',
  };

  const historyRows = history.map((h, i) => {
    const rColor = riskColors[h.risk_level as string] ?? '#6B7280';
    const cColor = cascadeColors[h.cascade_stage as string] ?? '#6B7280';
    const date = new Date(h.completed_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `
    <tr class="${i === 0 ? 'bg-indigo-50/40' : 'hover:bg-slate-50'} transition-colors">
      <td class="px-4 py-3 text-sm text-slate-600">${date}${i === 0 ? ' <span class="text-xs text-indigo-600 font-medium ml-1">Latest</span>' : ''}</td>
      <td class="px-4 py-3">
        <span class="text-sm font-bold" style="color:${rColor}">${(h.risk_score as number).toFixed(3)}</span>
      </td>
      <td class="px-4 py-3">
        <span class="text-xs font-semibold" style="color:${rColor}">${h.risk_level}</span>
      </td>
      <td class="px-4 py-3 text-xs font-medium" style="color:${cColor}">${h.cascade_stage}</td>
      <td class="px-4 py-3 text-xs text-slate-500">${(h.lsi as number).toFixed(2)} LSI · ${(h.lli_norm as number).toFixed(2)} LLI · ${((h.cei as number) * 100).toFixed(0)}% CEI</td>
      <td class="px-4 py-3">
        <a href="/assessment/${h.assessment_id}/brief" class="text-xs text-indigo-600 hover:underline font-medium">View Brief</a>
      </td>
    </tr>`;
  }).join('');

  const chartLabels = [...history].reverse().map(h =>
    new Date(h.completed_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  );
  const chartRisk = [...history].reverse().map(h => (h.risk_score as number).toFixed(4));
  const chartLSI  = [...history].reverse().map(h => (h.lsi as number).toFixed(3));

  const latestRiskColor = latest ? (riskColors[latest.risk_level as string] ?? '#6B7280') : '#6B7280';
  const patternMeta = latest ? SIGNAL_PATTERN_META[latest.signal_pattern as keyof typeof SIGNAL_PATTERN_META] : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>My Dashboard — LRI™</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body class="bg-slate-50">

<nav class="bg-white border-b border-slate-200 sticky top-0 z-10">
  <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
        <i class="fas fa-chart-line text-white text-sm"></i>
      </div>
      <span class="font-bold text-slate-900 text-sm tracking-tight">Leadership Risk Intelligence™</span>
    </div>
    <div class="flex items-center gap-4">
      <span class="text-sm text-slate-600 hidden sm:block">
        <i class="fas fa-user-circle mr-1 text-slate-400"></i>${name}
      </span>
      <a href="/org" class="text-xs text-slate-400 hover:text-slate-700 transition-colors">Org View</a>
      <a href="/logout" class="text-xs text-slate-400 hover:text-red-600 transition-colors">
        <i class="fas fa-sign-out-alt mr-1"></i>Logout
      </a>
    </div>
  </div>
</nav>

<div class="max-w-6xl mx-auto px-4 py-7 space-y-5">

  <!-- Header -->
  <div class="flex items-center justify-between flex-wrap gap-3">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Intelligence Dashboard</h1>
      <p class="text-sm text-slate-500 mt-0.5">Leadership Risk Intelligence™ · Personal View</p>
    </div>
    <div class="flex gap-2">
      ${inProgressId ? `
      <a href="/assessment/${inProgressId}/take"
        class="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
        <i class="fas fa-play"></i> Continue Assessment
      </a>` : `
      <a href="/assessment/new"
        class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
        <i class="fas fa-plus"></i> New Assessment
      </a>`}
    </div>
  </div>

  ${!latest ? `
  <!-- Empty State -->
  <div class="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-14 text-center">
    <div class="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
      <i class="fas fa-chart-radar text-indigo-400 text-2xl"></i>
    </div>
    <h3 class="text-lg font-semibold text-slate-800 mb-2">No assessments yet</h3>
    <p class="text-slate-500 text-sm mb-6 max-w-sm mx-auto">Complete your first Leadership Risk Intelligence™ assessment to generate your executive brief and risk profile.</p>
    <a href="/assessment/new" class="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-indigo-700 transition-colors">
      <i class="fas fa-play-circle"></i> Begin Assessment
    </a>
  </div>` : `

  <!-- THE INVESTOR VISUAL: Signal → Load → Concentration → Risk -->
  <div class="bg-slate-900 rounded-2xl p-5">
    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Leadership Risk Intelligence™ Engine · v3.1 · Risk = (CEI × LLI_norm) / LSI_norm</p>
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-2">
      ${[
        { label: 'LSI™ (raw)', value: (latest.lsi as number).toFixed(2), sub: `/ 5.0 · LSI_norm = ${((latest.lsi_norm as number) ?? ((latest.lsi as number)/5)).toFixed(3)}`, color: '#6366F1', icon: 'signal' },
        { label: 'Leadership Load', value: (latest.lli_norm as number).toFixed(3), sub: `LLI_norm · / 1.0`, color: '#F59E0B', icon: 'weight-hanging' },
        { label: 'Decision Concentration', value: ((latest.cei as number) * 100).toFixed(0) + '%', sub: `CEI™ · of total decisions`, color: '#F97316', icon: 'compress-arrows-alt' },
        { label: 'Decision Velocity', value: velocity > 0 ? velocity.toFixed(1) + '/d' : decisions30d + '/mo', sub: decisions30d + ' decisions · 30 days', color: '#8B5CF6', icon: 'bolt' },
        { label: 'Structural Risk', value: (latest.risk_score as number).toFixed(3), sub: latest.risk_level as string, color: latestRiskColor, icon: 'exclamation-triangle' },
      ].map((item, i) => `
      <div class="bg-white/5 border border-white/8 rounded-xl p-4 text-center">
        <i class="fas fa-${item.icon} text-lg mb-2" style="color:${item.color}"></i>
        <p class="text-xs text-slate-400 mb-1">${item.label}</p>
        <p class="text-2xl font-black" style="color:${item.color}">${item.value}</p>
        <p class="text-xs text-slate-500 mt-0.5 leading-tight">${item.sub}</p>
      </div>`).join('')}
    </div>
    ${ceiLive !== null ? `
    <div class="mt-3 bg-white/5 rounded-xl px-4 py-2 text-xs text-slate-400 flex flex-wrap gap-4">
      <span><i class="fas fa-chart-bar mr-1 text-purple-400"></i>Live Decision Concentration: <strong class="text-purple-300">${(ceiLive * 100).toFixed(1)}%</strong> of org decisions resolved by you (30d)</span>
      <span><i class="fas fa-sitemap mr-1 text-slate-500"></i>Org total: <strong class="text-slate-300">${orgTotal30d}</strong> decisions · Your share: <strong class="text-orange-300">${decisions30d}</strong></span>
    </div>` : ''}
  </div>

  <!-- Signal Radar + Cascade + Pattern -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

    <!-- Radar -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <p class="text-sm font-bold text-slate-800 mb-3">Signal Radar</p>
      <canvas id="radarChart" height="230"></canvas>
    </div>

    <!-- Cost Cascade -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <p class="text-sm font-bold text-slate-800 mb-1">Leadership Cost Cascade™</p>
      <p class="text-xs text-slate-400 mb-4">Classified by Risk Score (v3.1): ${(latest.risk_score as number).toFixed(3)}</p>
      <div class="space-y-1.5">
        ${CASCADE_STAGES.map(s => {
          const isActive = s.stage === (latest.cascade_stage as string);
          return `
          <div class="flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${isActive ? 'border' : ''}"
            style="${isActive ? `background:${s.bg};border-color:${s.color}44` : 'background:#F8FAFC'}">
            <div class="w-2 h-2 rounded-full flex-shrink-0" style="background:${isActive ? s.color : '#CBD5E1'}"></div>
            <span class="text-xs ${isActive ? 'font-bold' : 'font-medium text-slate-400'}"
              style="${isActive ? `color:${s.color}` : ''}">${s.stage}</span>
            ${isActive ? '<i class="fas fa-map-marker-alt text-xs ml-auto" style="color:' + s.color + '"></i>' : ''}
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Pattern + Trajectory -->
    <div class="space-y-4">
      ${patternMeta ? `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Signal Pattern</p>
        <div class="flex items-center gap-2 mb-2">
          <i class="fas fa-${patternMeta.icon} text-sm" style="color:${patternMeta.color}"></i>
          <span class="text-sm font-bold text-slate-900">${latest.signal_pattern}</span>
        </div>
        <p class="text-xs text-slate-600">${patternMeta.description}</p>
      </div>` : ''}
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Risk Score Breakdown</p>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between text-xs">
            <span class="text-slate-500">LSI™ (signals)</span>
            <span class="font-semibold text-indigo-600">${(latest.lsi as number).toFixed(3)}</span>
          </div>
          <div class="flex justify-between text-xs">
            <span class="text-slate-500">LSI_norm (LSI ÷ 5)</span>
            <span class="font-semibold text-indigo-400">${((latest.lsi_norm as number) ?? ((latest.lsi as number)/5)).toFixed(3)}</span>
          </div>
          <div class="flex justify-between text-xs">
            <span class="text-slate-500">LLI_norm (load)</span>
            <span class="font-semibold text-amber-600">${(latest.lli_norm as number).toFixed(3)}</span>
          </div>
          <div class="flex justify-between text-xs">
            <span class="text-slate-500">CEI (concentration)</span>
            <span class="font-semibold text-orange-600">${(latest.cei as number).toFixed(3)}</span>
          </div>
          <div class="border-t border-slate-100 pt-2 space-y-1">
            <div class="flex justify-between text-xs text-slate-400">
              <span class="font-mono">(CEI × LLI_norm) / LSI_norm</span>
            </div>
            <div class="flex justify-between text-xs">
              <span class="text-slate-600 font-medium">Leadership Risk Score™</span>
              <span class="font-black text-base" style="color:${latestRiskColor}">${(latest.risk_score as number).toFixed(4)}</span>
            </div>
          </div>
        </div>
      </div>
      <a href="/assessment/${latest.assessment_id}/brief"
        class="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-3 rounded-xl text-sm transition-colors w-full">
        <i class="fas fa-file-alt"></i> View Full Executive Brief
      </a>
    </div>
  </div>

  <!-- Trend Charts -->
  ${history.length > 1 ? `
  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <p class="text-sm font-bold text-slate-800 mb-3">Risk Score™ Trajectory</p>
      <canvas id="riskTrend" height="100"></canvas>
    </div>
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <p class="text-sm font-bold text-slate-800 mb-3">LSI™ Trajectory</p>
      <canvas id="lsiTrend" height="100"></canvas>
    </div>
  </div>` : ''}

  <!-- ═══ STRUCTURAL INTERVENTION ENGINE™ ═══ -->
  ${interventionReport ? renderInterventionPanel(interventionReport, latest.assessment_id as number) : ''}

  <!-- History Table -->
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
      <h2 class="text-sm font-bold text-slate-800">Assessment History</h2>
      <span class="text-xs text-slate-400">${history.length} completed</span>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-slate-100 bg-slate-50">
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Date</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Risk Score™</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Risk Level</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Cascade Stage</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Metrics</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${historyRows || `<tr><td colspan="6" class="px-4 py-10 text-center text-sm text-slate-400">Complete an assessment to see your history.</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>

  `}
</div>

<script>
${latest ? `
// Radar Chart
const rCtx = document.getElementById('radarChart')?.getContext('2d');
if (rCtx) {
  new Chart(rCtx, {
    type: 'radar',
    data: {
      labels: ['Stress\\nReg.','Cognitive\\nBreadth','Trust\\nClimate','Ethical\\nIntegrity','Leadership\\nDurability','Adaptive\\nCapacity'],
      datasets: [{
        label: 'Signal Profile',
        data: [${DOMAIN_KEYS.map(k => (latest[k] as number ?? 0).toFixed(2)).join(',')}],
        backgroundColor: 'rgba(99,102,241,0.12)',
        borderColor: '#6366F1',
        borderWidth: 2,
        pointBackgroundColor: '#6366F1',
        pointRadius: 4,
      }]
    },
    options: {
      responsive: true,
      scales: { r: { min:0, max:5, ticks:{ stepSize:1, font:{size:8} }, grid:{color:'#E2E8F0'}, pointLabels:{font:{size:8}} } },
      plugins: { legend: { display: false } }
    }
  });
}

${history.length > 1 ? `
// Risk trend
const rt = document.getElementById('riskTrend')?.getContext('2d');
if (rt) {
  new Chart(rt, {
    type: 'line',
    data: {
      labels: ${JSON.stringify(chartLabels)},
      datasets: [{
        data: [${chartRisk.join(',')}],
        borderColor: '#EF4444', backgroundColor: '#EF444420',
        borderWidth: 2, pointRadius: 4, fill: true, tension: 0.3
      }]
    },
    options: { responsive: true, plugins:{legend:{display:false}},
      scales: { y: { min:0, grid:{color:'#F1F5F9'} }, x:{grid:{display:false}} } }
  });
}
// LSI trend
const lt = document.getElementById('lsiTrend')?.getContext('2d');
if (lt) {
  new Chart(lt, {
    type: 'line',
    data: {
      labels: ${JSON.stringify(chartLabels)},
      datasets: [{
        data: [${chartLSI.join(',')}],
        borderColor: '#6366F1', backgroundColor: '#6366F120',
        borderWidth: 2, pointRadius: 4, fill: true, tension: 0.3
      }]
    },
    options: { responsive: true, plugins:{legend:{display:false}},
      scales: { y: { min:0, max:5, grid:{color:'#F1F5F9'} }, x:{grid:{display:false}} } }
  });
}` : ''}
` : ''}
</script>
</body></html>`;
}

export default dashboard;
