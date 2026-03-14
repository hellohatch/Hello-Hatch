// Organization Dashboard — Enterprise Portfolio View

import { Hono } from 'hono';
import type { Bindings, Variables } from '../types/index.js';
import { requireAuth } from '../lib/auth.js';
import { hashPassword } from '../lib/auth.js';
import { CASCADE_STAGES, RISK_LEVELS, SIGNAL_PATTERN_META } from '../lib/scoring.js';
import { DOMAIN_META, DOMAIN_KEYS } from '../lib/questions.js';

const org = new Hono<{ Bindings: Bindings; Variables: Variables }>();
org.use('*', requireAuth);

// ── GET /org ── Portfolio Overview
org.get('/', async (c) => {
  const orgId      = c.get('orgId');
  const leaderName = c.get('leaderName');
  const leaderRole = c.get('leaderRole');

  // Org info
  const orgRow = await c.env.DB.prepare('SELECT * FROM organizations WHERE organization_id=?')
    .bind(orgId).first<{ name: string; industry: string; employee_count: number }>();

  // All leaders with latest scores
  const leaders = await c.env.DB.prepare(`
    SELECT l.leader_id, l.name, l.email, l.role_level, l.system_role, l.created_at,
           rs.lsi, rs.lli_norm, rs.cei, rs.risk_score, rs.risk_level,
           rs.cascade_stage, rs.cascade_level, rs.signal_pattern, rs.trajectory_direction,
           rs.stress_regulation, rs.cognitive_breadth, rs.trust_climate,
           rs.ethical_integrity, rs.leadership_durability, rs.adaptive_capacity,
           a.completed_at, a.assessment_id as latest_assessment_id,
           (SELECT COUNT(*) FROM assessments WHERE leader_id=l.leader_id AND status='completed') as total_assessments
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

  // Aggregate stats
  const avgRisk = assessed.length > 0
    ? assessed.reduce((s, l) => s + (l.risk_score as number), 0) / assessed.length
    : null;
  const avgLSI = assessed.length > 0
    ? assessed.reduce((s, l) => s + (l.lsi as number), 0) / assessed.length
    : null;

  const riskBuckets: Record<string, number> = {
    'Low structural risk': 0, 'Early exposure': 0,
    'Emerging dependency': 0, 'Structural bottleneck': 0, 'Organizational risk': 0,
  };
  const cascadeBuckets: Record<string, number> = {};
  const patternBuckets: Record<string, number> = {};

  for (const l of assessed) {
    const rl = l.risk_level as string;
    const cs = l.cascade_stage as string;
    const sp = l.signal_pattern as string;
    if (riskBuckets[rl] !== undefined) riskBuckets[rl]++;
    cascadeBuckets[cs] = (cascadeBuckets[cs] ?? 0) + 1;
    patternBuckets[sp]  = (patternBuckets[sp]  ?? 0) + 1;
  }

  return c.html(orgPage(
    leaderName, leaderRole, orgRow?.name ?? 'Your Organization',
    orgRow?.industry ?? '', all, assessed,
    avgRisk, avgLSI, riskBuckets, cascadeBuckets, patternBuckets
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
           rs.lsi, rs.lli_norm, rs.cei, rs.risk_score, rs.risk_level,
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
// TEMPLATES
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
  patternBuckets: Record<string, number>
): string {

  const rColors: Record<string, string> = {
    'Low structural risk': '#10B981', 'Early exposure': '#84CC16',
    'Emerging dependency': '#F59E0B', 'Structural bottleneck': '#F97316',
    'Organizational risk': '#EF4444',
  };
  const cColors: Record<string, string> = {
    'Healthy Distribution': '#10B981', 'Emerging Exposure': '#84CC16',
    'Structural Dependency': '#F59E0B', 'Decision Bottleneck': '#F97316',
    'Organizational Drag': '#EF4444',
  };
  const atRisk = (riskBuckets['Structural bottleneck'] ?? 0) + (riskBuckets['Organizational risk'] ?? 0);

  const leaderRows = all.map(l => {
    const rs  = l.risk_score as number | null;
    const rColor = rs != null ? (rColors[l.risk_level as string] ?? '#6B7280') : '#CBD5E1';
    const initials = (l.name as string).split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
    const date = l.completed_at
      ? new Date(l.completed_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '—';

    const miniBar = (val: number | null, color: string) => {
      if (val == null) return '<div class="w-4 h-3 bg-slate-200 rounded-sm"></div>';
      const pct = Math.round(((val - 1) / 4) * 100);
      return `<div class="w-4 h-3 rounded-sm overflow-hidden bg-slate-100">
        <div class="h-full rounded-sm" style="width:${pct}%;background:${color}"></div>
      </div>`;
    };

    return `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="px-4 py-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style="background:${rColor}88">
            <span style="color:${rColor}">${initials}</span>
          </div>
          <div>
            <a href="/org/leader/${l.leader_id}" class="text-sm font-semibold text-slate-800 hover:text-indigo-600 transition-colors">${l.name}</a>
            <p class="text-xs text-slate-400">${l.role_level ?? ''}</p>
          </div>
        </div>
      </td>
      <td class="px-4 py-3">
        ${rs != null ? `
        <div class="flex items-center gap-1.5">
          <span class="text-base font-black" style="color:${rColor}">${rs.toFixed(3)}</span>
        </div>` : '<span class="text-xs text-slate-400">—</span>'}
      </td>
      <td class="px-4 py-3">
        <span class="text-xs font-medium" style="color:${rColor}">${rs != null ? l.risk_level : '—'}</span>
      </td>
      <td class="px-4 py-3">
        <span class="text-xs" style="color:${l.cascade_stage ? (cColors[l.cascade_stage as string] ?? '#6B7280') : '#CBD5E1'}">${l.cascade_stage ?? '—'}</span>
      </td>
      <td class="px-4 py-3">
        ${rs != null ? `
        <div class="flex items-end gap-0.5">
          ${DOMAIN_KEYS.map((k, i) => miniBar(l[k] as number | null, DOMAIN_META[i].color)).join('')}
        </div>` : '<span class="text-xs text-slate-400">Not assessed</span>'}
      </td>
      <td class="px-4 py-3 text-xs text-slate-400">${date}</td>
      <td class="px-4 py-3 text-xs text-slate-400">${l.total_assessments ?? 0}</td>
      <td class="px-4 py-3">
        <a href="/org/leader/${l.leader_id}" class="text-xs text-indigo-600 hover:underline">Details</a>
      </td>
    </tr>`;
  }).join('');

  // Domain heat map data
  const domainAverages = DOMAIN_KEYS.map(k => {
    const vals = assessed.map(l => l[k] as number).filter(Boolean);
    const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    return { key: k, avg };
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Organization Dashboard — LRI™</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
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
      <span class="text-xs text-slate-500">${adminName}</span>
      <a href="/logout" class="text-xs text-slate-400 hover:text-red-600"><i class="fas fa-sign-out-alt"></i></a>
    </div>
  </div>
</nav>

<div class="max-w-7xl mx-auto px-4 py-7 space-y-5">

  <!-- Header -->
  <div class="flex items-start justify-between flex-wrap gap-3">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Organization Intelligence View</h1>
      <p class="text-slate-500 text-sm mt-0.5">${orgName} · ${industry} · ${all.length} leaders</p>
    </div>
    ${adminRole === 'admin' ? `
    <button onclick="document.getElementById('addModal').classList.remove('hidden')"
      class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
      <i class="fas fa-user-plus"></i> Add Leader
    </button>` : ''}
  </div>

  <!-- KPI Row -->
  <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
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
      <p class="text-2xl font-black" style="color:${avgRisk != null ? (avgRisk > 0.20 ? '#EF4444' : avgRisk > 0.10 ? '#F97316' : '#10B981') : '#CBD5E1'}">${avgRisk != null ? avgRisk.toFixed(3) : '—'}</p>
    </div>
    <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <p class="text-xs text-slate-400 mb-1">Avg LSI™</p>
      <p class="text-2xl font-black text-indigo-600">${avgLSI != null ? avgLSI.toFixed(2) : '—'}</p>
    </div>
    <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <p class="text-xs text-slate-400 mb-1">At Risk (Structural+)</p>
      <p class="text-2xl font-black text-red-600">${atRisk}</p>
    </div>
  </div>

  <!-- Charts Row -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-5">

    <!-- Risk Distribution -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <p class="text-sm font-bold text-slate-800 mb-4">Risk Level Distribution</p>
      <canvas id="riskDistChart" height="180"></canvas>
      <div class="mt-3 space-y-1.5">
        ${Object.entries(riskBuckets).map(([level, count]) => `
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full" style="background:${rColors[level]}"></div>
            <span class="text-slate-600">${level}</span>
          </div>
          <span class="font-semibold text-slate-800">${count}</span>
        </div>`).join('')}
      </div>
    </div>

    <!-- Cascade Distribution -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <p class="text-sm font-bold text-slate-800 mb-3">Leadership Cost Cascade™ Distribution</p>
      <div class="space-y-2">
        ${CASCADE_STAGES.map(s => {
          const count = cascadeBuckets[s.stage] ?? 0;
          const pct = assessed.length > 0 ? Math.round((count / assessed.length) * 100) : 0;
          return `
          <div>
            <div class="flex items-center justify-between mb-0.5">
              <span class="text-xs text-slate-600">${s.stage}</span>
              <span class="text-xs font-semibold text-slate-700">${count}</span>
            </div>
            <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all" style="width:${pct}%;background:${s.color}"></div>
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
          const avg = d.avg;
          const pct = avg != null ? Math.round(((avg - 1) / 4) * 100) : 0;
          const heatColor = avg != null
            ? (avg >= 4.0 ? '#10B981' : avg >= 3.0 ? '#F59E0B' : '#EF4444')
            : '#CBD5E1';
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
          <span class="text-sm font-black text-indigo-600">${avgLSI.toFixed(2)}</span>
        </div>` : ''}
      </div>
    </div>

  </div>

  <!-- Leader Portfolio Table -->
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
      <h2 class="text-sm font-bold text-slate-800">Leadership Risk Map</h2>
      <span class="text-xs text-slate-400">Sorted by risk (highest first)</span>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-slate-100 bg-slate-50">
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Leader</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Risk Score™</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Risk Level</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Cascade Stage</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Domain Signals</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Last</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Assessments</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${leaderRows || `<tr><td colspan="8" class="px-4 py-10 text-center text-sm text-slate-400">No leaders yet.</td></tr>`}
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
      <button onclick="document.getElementById('addModal').classList.add('hidden')" class="text-slate-400 hover:text-slate-600">
        <i class="fas fa-times"></i>
      </button>
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
        <button type="button" onclick="document.getElementById('addModal').classList.add('hidden')"
          class="flex-1 border border-slate-300 text-slate-600 font-medium py-2.5 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
        <button type="submit" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl text-sm">Add Leader</button>
      </div>
    </form>
  </div>
</div>` : ''}

<script>
const rDistCtx = document.getElementById('riskDistChart')?.getContext('2d');
if (rDistCtx) {
  new Chart(rDistCtx, {
    type: 'doughnut',
    data: {
      labels: ${JSON.stringify(Object.keys(riskBuckets))},
      datasets: [{
        data: ${JSON.stringify(Object.values(riskBuckets))},
        backgroundColor: ${JSON.stringify(Object.keys(riskBuckets).map(k => ({
          'Low structural risk': '#10B981', 'Early exposure': '#84CC16',
          'Emerging dependency': '#F59E0B', 'Structural bottleneck': '#F97316',
          'Organizational risk': '#EF4444',
        }[k] ?? '#CBD5E1')))},
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true, cutout: '60%',
      plugins: { legend: { display: false } }
    }
  });
}
</script>
</body></html>`;
}

function leaderDetailPage(leader: Record<string, unknown>, assessments: Record<string, unknown>[]): string {
  const latest = assessments[0];
  const rColors: Record<string, string> = {
    'Low structural risk': '#10B981', 'Early exposure': '#84CC16',
    'Emerging dependency': '#F59E0B', 'Structural bottleneck': '#F97316',
    'Organizational risk': '#EF4444',
  };

  const histRows = assessments.map((a, i) => {
    const rColor = rColors[a.risk_level as string] ?? '#6B7280';
    const date = new Date(a.completed_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `
    <tr class="${i === 0 ? 'bg-indigo-50/40' : 'hover:bg-slate-50'} transition-colors">
      <td class="px-4 py-3 text-sm text-slate-600">${date}</td>
      <td class="px-4 py-3 text-sm font-black" style="color:${rColor}">${(a.risk_score as number).toFixed(3)}</td>
      <td class="px-4 py-3 text-xs font-medium" style="color:${rColor}">${a.risk_level}</td>
      <td class="px-4 py-3 text-xs text-slate-500">${a.cascade_stage}</td>
      <td class="px-4 py-3 text-xs text-slate-500">${(a.lsi as number).toFixed(2)} · ${(a.lli_norm as number).toFixed(2)} · ${((a.cei as number)*100).toFixed(0)}%</td>
      <td class="px-4 py-3">
        <a href="/assessment/${a.assessment_id}/brief" class="text-xs text-indigo-600 hover:underline font-medium">View Brief</a>
      </td>
    </tr>`;
  }).join('');

  const rColor = latest ? (rColors[latest.risk_level as string] ?? '#6B7280') : '#6B7280';
  const chartData = [...assessments].reverse();

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
  <!-- Header -->
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-start justify-between flex-wrap gap-4">
    <div class="flex items-center gap-4">
      <div class="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg" style="background:${rColor}">
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
      <p class="text-xs font-semibold" style="color:${rColor}">${latest.risk_level}</p>
      <p class="text-xs text-slate-400 mt-1">${latest.cascade_stage}</p>
    </div>` : ''}
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
  </div>` : ''}

  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div class="px-5 py-4 border-b border-slate-100"><h3 class="text-sm font-bold text-slate-800">Assessment History</h3></div>
    <table class="w-full">
      <thead><tr class="border-b border-slate-100 bg-slate-50">
        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Date</th>
        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Risk Score™</th>
        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Risk Level</th>
        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Cascade Stage</th>
        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">LSI · LLI · CEI</th>
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
