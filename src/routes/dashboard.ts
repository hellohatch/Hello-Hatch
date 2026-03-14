// Dashboard Routes — Leader Executive View

import { Hono } from 'hono';
import type { Bindings, Variables } from '../types/index.js';
import { requireAuth } from '../lib/auth.js';

const dashboard = new Hono<{ Bindings: Bindings; Variables: Variables }>();

dashboard.use('*', requireAuth);

// ── GET /dashboard ──
dashboard.get('/', async (c) => {
  const db = c.env.DB;
  const userId = c.get('userId');
  const userName = c.get('userName');
  const orgId = c.get('orgId');

  // Get all completed assessments for this leader
  const assessments = await db.prepare(`
    SELECT a.id, a.status, a.started_at, a.completed_at, a.org_stage,
           s.lsi_composite, s.risk_tier, s.tier_label, s.intervention_type,
           s.operational_stability, s.cognitive_breadth, s.ethical_integrity,
           s.trust_climate, s.adaptive_capacity, s.leadership_durability,
           s.operational_band, s.cognitive_band, s.ethical_band,
           s.trust_band, s.adaptive_band, s.durability_band
    FROM assessments a
    LEFT JOIN signal_scores s ON s.assessment_id = a.id
    WHERE a.leader_id = ?
    ORDER BY a.started_at DESC
    LIMIT 20
  `).bind(userId).all<Record<string, unknown>>();

  const completed = (assessments.results ?? []).filter(a => a.status === 'completed' || a.status === 'flagged');
  const inProgress = (assessments.results ?? []).filter(a => a.status === 'in_progress');
  const latest = completed[0] ?? null;

  return c.html(dashboardPage(userName, completed, inProgress, latest));
});

// ──────────────────────────────────────────────
// PAGE TEMPLATE
// ──────────────────────────────────────────────

function dashboardPage(
  userName: string,
  completed: Record<string, unknown>[],
  inProgress: Record<string, unknown>[],
  latest: Record<string, unknown> | null
): string {
  const tierColors: Record<string, string> = {
    Green: '#10B981', Yellow: '#F59E0B', Orange: '#F97316', Red: '#EF4444'
  };
  const tierBadge: Record<string, string> = {
    Green: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    Yellow: 'bg-amber-100 text-amber-800 border border-amber-200',
    Orange: 'bg-orange-100 text-orange-800 border border-orange-200',
    Red: 'bg-red-100 text-red-800 border border-red-200',
  };

  const domainKeys = [
    { key: 'operational_stability', label: 'Operational', bandKey: 'operational_band' },
    { key: 'cognitive_breadth', label: 'Cognitive', bandKey: 'cognitive_band' },
    { key: 'ethical_integrity', label: 'Ethical', bandKey: 'ethical_band' },
    { key: 'trust_climate', label: 'Trust', bandKey: 'trust_band' },
    { key: 'adaptive_capacity', label: 'Adaptive', bandKey: 'adaptive_band' },
    { key: 'leadership_durability', label: 'Durability', bandKey: 'durability_band' },
  ];

  const latestScoreCards = latest ? domainKeys.map(d => {
    const score = latest[d.key] as number ?? 0;
    const band = latest[d.bandKey] as string ?? '';
    const color = latest.risk_tier ? tierColors[latest.risk_tier as string] : '#6B7280';
    return `
    <div class="bg-white border border-slate-200 rounded-xl p-4">
      <p class="text-xs text-slate-500 mb-1">${d.label}</p>
      <p class="text-2xl font-bold text-slate-900">${score}</p>
      <div class="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div class="h-full rounded-full" style="width:${score}%;background:${color}"></div>
      </div>
      <p class="text-xs text-slate-400 mt-1">${band}</p>
    </div>`;
  }).join('') : '';

  const historyRows = completed.slice(0, 8).map((a, i) => {
    const tier = a.risk_tier as string;
    const date = new Date(a.completed_at as string ?? a.started_at as string)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const badge = tierBadge[tier] ?? 'bg-slate-100 text-slate-700';
    const isCurrent = i === 0;
    return `
    <tr class="${isCurrent ? 'bg-blue-50/50' : 'hover:bg-slate-50'} transition-colors">
      <td class="px-4 py-3 text-sm text-slate-600">${date}${isCurrent ? ' <span class="text-xs text-blue-600 font-medium">(Latest)</span>' : ''}</td>
      <td class="px-4 py-3">
        <span class="text-sm font-bold text-slate-900">${a.lsi_composite ?? '—'}</span>
        <span class="text-xs text-slate-400">/100</span>
      </td>
      <td class="px-4 py-3">
        <span class="text-xs font-semibold px-2 py-1 rounded-full ${badge}">${tier} — ${a.tier_label ?? ''}</span>
      </td>
      <td class="px-4 py-3 text-xs text-slate-500 capitalize">${a.intervention_type ?? '—'}</td>
      <td class="px-4 py-3">
        <a href="/assessment/${a.id}/results" class="text-xs text-blue-600 hover:underline">View brief</a>
      </td>
    </tr>`;
  }).join('');

  // Build chart data for trend line
  const chartData = completed.slice(0, 10).reverse().map(a => ({
    date: new Date(a.completed_at as string ?? a.started_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    composite: a.lsi_composite ?? 0,
  }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard — LSI™</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body class="bg-slate-50">
  <!-- Nav -->
  <nav class="bg-white border-b border-slate-200 sticky top-0 z-10">
    <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <i class="fas fa-chart-line text-white text-sm"></i>
        </div>
        <span class="font-bold text-slate-900 text-sm">Leadership Signal Index™</span>
      </div>
      <div class="flex items-center gap-4">
        <span class="text-sm text-slate-600">
          <i class="fas fa-user-circle mr-1"></i>
          ${userName}
        </span>
        <a href="/admin" class="text-xs text-slate-400 hover:text-slate-600">Admin</a>
        <a href="/logout" class="text-xs text-slate-500 hover:text-red-600">
          <i class="fas fa-sign-out-alt mr-1"></i>Logout
        </a>
      </div>
    </div>
  </nav>

  <div class="max-w-6xl mx-auto px-4 py-8 space-y-6">

    <!-- Header -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Your Signal Dashboard</h1>
        <p class="text-slate-500 text-sm mt-1">Leadership Risk Intelligence — Personal View</p>
      </div>
      <div class="flex gap-3">
        ${inProgress.length > 0 ? `
        <a href="/assessment/${inProgress[0].id}/questions"
           class="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <i class="fas fa-play-circle"></i> Continue Assessment
        </a>` : `
        <a href="/assessment/new"
           class="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <i class="fas fa-plus"></i> New Assessment
        </a>`}
      </div>
    </div>

    ${!latest ? `
    <!-- Empty State -->
    <div class="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
      <div class="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <i class="fas fa-chart-radar text-blue-400 text-2xl"></i>
      </div>
      <h3 class="text-lg font-semibold text-slate-800 mb-2">No assessments yet</h3>
      <p class="text-slate-500 text-sm mb-6 max-w-sm mx-auto">Take your first Leadership Signal Assessment to generate your risk profile and intervention recommendations.</p>
      <a href="/assessment/new" class="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-blue-700 transition-colors">
        <i class="fas fa-play-circle"></i> Start First Assessment
      </a>
    </div>` : `

    <!-- Latest Score Overview -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div class="flex items-start justify-between mb-5">
        <div>
          <h2 class="text-base font-bold text-slate-800">Latest Signal Profile</h2>
          <p class="text-xs text-slate-400 mt-0.5">
            ${new Date(latest.completed_at as string ?? latest.started_at as string).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div class="flex items-center gap-4">
          <div class="text-right">
            <p class="text-3xl font-bold" style="color:${tierColors[latest.risk_tier as string] ?? '#6B7280'}">${latest.lsi_composite ?? '—'}</p>
            <p class="text-xs text-slate-400">Composite Score</p>
          </div>
          <div>
            <span class="text-sm font-semibold px-3 py-1.5 rounded-full ${tierBadge[latest.risk_tier as string] ?? 'bg-slate-100 text-slate-700'}">
              ${latest.risk_tier} — ${latest.tier_label}
            </span>
            <p class="text-xs text-slate-400 mt-1 text-center capitalize">${latest.intervention_type} intervention</p>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-3 md:grid-cols-6 gap-3">
        ${latestScoreCards}
      </div>
      <div class="mt-4 flex justify-end">
        <a href="/assessment/${latest.id}/results" class="text-sm text-blue-600 hover:text-blue-800 font-medium">
          View full executive brief <i class="fas fa-arrow-right ml-1"></i>
        </a>
      </div>
    </div>

    <!-- Trend Chart -->
    ${chartData.length > 1 ? `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h2 class="text-base font-bold text-slate-800 mb-4">LSI™ Composite Trend</h2>
      <canvas id="trendChart" height="80"></canvas>
    </div>` : ''}

    <!-- Assessment History -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h2 class="text-base font-bold text-slate-800">Assessment History</h2>
        <span class="text-xs text-slate-400">${completed.length} completed</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-slate-100">
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Score</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Risk Tier</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Intervention</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${historyRows || '<tr><td colspan="5" class="px-4 py-8 text-center text-sm text-slate-400">No completed assessments</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`}

  </div>

  ${chartData.length > 1 ? `
  <script>
    const ctx = document.getElementById('trendChart')?.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: ${JSON.stringify(chartData.map(d => d.date))},
          datasets: [{
            label: 'LSI™ Composite',
            data: ${JSON.stringify(chartData.map(d => d.composite))},
            borderColor: '#3B82F6',
            backgroundColor: '#3B82F620',
            borderWidth: 2.5,
            pointBackgroundColor: '#3B82F6',
            pointRadius: 5,
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { min: 0, max: 100, grid: { color: '#F1F5F9' } },
            x: { grid: { display: false } }
          }
        }
      });
    }
  </script>` : ''}
</body>
</html>`;
}

export default dashboard;
