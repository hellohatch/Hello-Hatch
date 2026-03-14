// Admin Routes — Organization Portfolio View

import { Hono } from 'hono';
import type { Bindings, Variables } from '../types/index.js';
import { requireAuth } from '../lib/auth.js';
import { hashPassword } from '../lib/auth.js';

const admin = new Hono<{ Bindings: Bindings; Variables: Variables }>();

admin.use('*', requireAuth);

// Require admin role
admin.use('*', async (c, next) => {
  if (c.get('userRole') !== 'admin') {
    return c.redirect('/dashboard');
  }
  await next();
});

// ── GET /admin ── Portfolio Overview
admin.get('/', async (c) => {
  const db = c.env.DB;
  const orgId = c.get('orgId');
  const userName = c.get('userName');

  // Get org info
  const org = await db.prepare('SELECT * FROM organizations WHERE id = ?')
    .bind(orgId).first<{ name: string; type: string }>();

  // Get all leaders in org with their latest scores
  const leaders = await db.prepare(`
    SELECT u.id, u.name, u.email, u.role_level, u.created_at,
           s.lsi_composite, s.risk_tier, s.tier_label, s.intervention_type,
           s.operational_stability, s.cognitive_breadth, s.ethical_integrity,
           s.trust_climate, s.adaptive_capacity, s.leadership_durability,
           a.completed_at, a.id as latest_assessment_id,
           (SELECT COUNT(*) FROM assessments WHERE leader_id = u.id AND status IN ('completed','flagged')) as assessment_count
    FROM users u
    LEFT JOIN assessments a ON a.id = (
      SELECT id FROM assessments WHERE leader_id = u.id
      AND status IN ('completed', 'flagged')
      ORDER BY completed_at DESC LIMIT 1
    )
    LEFT JOIN signal_scores s ON s.assessment_id = a.id
    WHERE u.org_id = ?
    ORDER BY s.lsi_composite ASC NULLS LAST
  `).bind(orgId).all<Record<string, unknown>>();

  // Portfolio stats
  const scoredLeaders = (leaders.results ?? []).filter(l => l.lsi_composite !== null);
  const avgComposite = scoredLeaders.length > 0
    ? Math.round(scoredLeaders.reduce((s, l) => s + (l.lsi_composite as number), 0) / scoredLeaders.length)
    : null;

  const tierCounts: Record<string, number> = { Green: 0, Yellow: 0, Orange: 0, Red: 0 };
  for (const l of scoredLeaders) {
    const tier = l.risk_tier as string;
    if (tier && tierCounts[tier] !== undefined) tierCounts[tier]++;
  }

  return c.html(adminPage(userName, org?.name ?? 'Your Organization', leaders.results ?? [], avgComposite, tierCounts, orgId));
});

// ── POST /admin/invite ── Add a leader
admin.post('/invite', async (c) => {
  const db = c.env.DB;
  const orgId = c.get('orgId');
  const body = await c.req.parseBody();

  const name = (body.name as string)?.trim();
  const email = (body.email as string)?.toLowerCase().trim();
  const roleLevel = body.role_level as string;

  if (!name || !email) return c.redirect('/admin?error=Name+and+email+required');

  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return c.redirect('/admin?error=Email+already+registered');

  // Create with temp password
  const tempPass = 'Welcome123!';
  const hash = await hashPassword(tempPass);

  await db.prepare(
    'INSERT INTO users (org_id, email, name, role, role_level, password_hash) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(orgId, email, name, 'leader', roleLevel ?? 'Director', hash).run();

  return c.redirect('/admin?success=Leader+added+successfully');
});

// ── GET /admin/leader/:id ── Individual leader detail
admin.get('/leader/:id', async (c) => {
  const db = c.env.DB;
  const orgId = c.get('orgId');
  const leaderId = parseInt(c.req.param('id'));

  const leader = await db.prepare(
    'SELECT * FROM users WHERE id = ? AND org_id = ?'
  ).bind(leaderId, orgId).first<Record<string, unknown>>();

  if (!leader) return c.redirect('/admin');

  const assessments = await db.prepare(`
    SELECT a.id, a.status, a.started_at, a.completed_at, a.org_stage,
           s.lsi_composite, s.risk_tier, s.tier_label, s.intervention_type,
           s.operational_stability, s.cognitive_breadth, s.ethical_integrity,
           s.trust_climate, s.adaptive_capacity, s.leadership_durability,
           s.convergence_flag, s.concentration_signature, s.drift_acceleration, s.protective_buffer
    FROM assessments a
    LEFT JOIN signal_scores s ON s.assessment_id = a.id
    WHERE a.leader_id = ? AND a.status IN ('completed', 'flagged')
    ORDER BY a.completed_at DESC
    LIMIT 10
  `).bind(leaderId).all<Record<string, unknown>>();

  return c.html(leaderDetailPage(leader, assessments.results ?? []));
});

// ──────────────────────────────────────────────
// PAGE TEMPLATES
// ──────────────────────────────────────────────

function adminPage(
  adminName: string,
  orgName: string,
  leaders: Record<string, unknown>[],
  avgComposite: number | null,
  tierCounts: Record<string, number>,
  orgId: number
): string {
  const tierColors: Record<string, string> = {
    Green: '#10B981', Yellow: '#F59E0B', Orange: '#F97316', Red: '#EF4444'
  };
  const tierBadge: Record<string, string> = {
    Green: 'bg-emerald-100 text-emerald-800',
    Yellow: 'bg-amber-100 text-amber-800',
    Orange: 'bg-orange-100 text-orange-800',
    Red: 'bg-red-100 text-red-800',
  };

  const leaderRows = leaders.map(l => {
    const tier = l.risk_tier as string;
    const composite = l.lsi_composite as number;
    const color = tierColors[tier] ?? '#94A3B8';
    const date = l.completed_at
      ? new Date(l.completed_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '—';

    const miniScores = [
      l.operational_stability, l.cognitive_breadth, l.ethical_integrity,
      l.trust_climate, l.adaptive_capacity, l.leadership_durability
    ].map((s, i) => {
      const sc = (s as number) ?? 0;
      return `<div class="flex flex-col items-center">
        <div class="w-4 bg-slate-100 rounded-sm overflow-hidden" style="height:20px">
          <div class="w-full rounded-sm" style="height:${Math.round(sc/5)}px;background:${color};margin-top:${20-Math.round(sc/5)}px"></div>
        </div>
      </div>`;
    }).join('');

    return `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="px-4 py-3">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            ${(l.name as string ?? '?').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
          </div>
          <div>
            <a href="/admin/leader/${l.id}" class="text-sm font-semibold text-slate-800 hover:text-blue-600">${l.name}</a>
            <p class="text-xs text-slate-400">${l.role_level ?? ''}</p>
          </div>
        </div>
      </td>
      <td class="px-4 py-3">
        ${composite != null ? `
        <div class="flex items-center gap-2">
          <span class="text-lg font-bold" style="color:${color}">${composite}</span>
          <div class="flex items-end gap-0.5">${miniScores}</div>
        </div>` : '<span class="text-sm text-slate-400">Not assessed</span>'}
      </td>
      <td class="px-4 py-3">
        ${tier ? `<span class="text-xs font-semibold px-2 py-1 rounded-full ${tierBadge[tier] ?? 'bg-slate-100 text-slate-700'}">${tier}</span>` : '<span class="text-xs text-slate-400">—</span>'}
      </td>
      <td class="px-4 py-3 text-xs text-slate-500 capitalize">${l.intervention_type ?? '—'}</td>
      <td class="px-4 py-3 text-xs text-slate-400">${date}</td>
      <td class="px-4 py-3 text-xs text-slate-400">${l.assessment_count ?? 0} assessments</td>
      <td class="px-4 py-3">
        <a href="/admin/leader/${l.id}" class="text-xs text-blue-600 hover:underline">View</a>
      </td>
    </tr>`;
  }).join('');

  const totalLeaders = leaders.length;
  const assessedLeaders = leaders.filter(l => l.lsi_composite !== null).length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin — LSI™ Portfolio</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body class="bg-slate-50">
  <!-- Nav -->
  <nav class="bg-white border-b border-slate-200 sticky top-0 z-10">
    <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <i class="fas fa-chart-line text-white text-sm"></i>
        </div>
        <span class="font-bold text-slate-900 text-sm">Leadership Signal Index™</span>
        <span class="text-slate-300 mx-1">|</span>
        <span class="text-sm text-slate-600">${orgName}</span>
      </div>
      <div class="flex items-center gap-4">
        <a href="/dashboard" class="text-xs text-slate-500 hover:text-slate-700">My Dashboard</a>
        <span class="text-sm text-slate-600">${adminName}</span>
        <a href="/logout" class="text-xs text-slate-500 hover:text-red-600"><i class="fas fa-sign-out-alt"></i></a>
      </div>
    </div>
  </nav>

  <div class="max-w-7xl mx-auto px-4 py-8 space-y-6">

    <!-- Header -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Portfolio Overview</h1>
        <p class="text-slate-500 text-sm mt-1">Organization-level leadership risk intelligence</p>
      </div>
      <button onclick="document.getElementById('inviteModal').classList.remove('hidden')"
        class="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
        <i class="fas fa-user-plus"></i> Add Leader
      </button>
    </div>

    <!-- Stats Row -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <p class="text-xs text-slate-500 mb-1">Total Leaders</p>
        <p class="text-2xl font-bold text-slate-900">${totalLeaders}</p>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <p class="text-xs text-slate-500 mb-1">Assessed</p>
        <p class="text-2xl font-bold text-slate-900">${assessedLeaders}</p>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <p class="text-xs text-slate-500 mb-1">Avg LSI™ Score</p>
        <p class="text-2xl font-bold text-slate-900">${avgComposite ?? '—'}</p>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <p class="text-xs text-slate-500 mb-1">At Risk (Orange/Red)</p>
        <p class="text-2xl font-bold text-orange-600">${(tierCounts.Orange ?? 0) + (tierCounts.Red ?? 0)}</p>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <p class="text-xs text-slate-500 mb-1">Urgent Tier</p>
        <p class="text-2xl font-bold text-red-600">${tierCounts.Red ?? 0}</p>
      </div>
    </div>

    <!-- Tier Distribution + Chart -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="md:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 class="text-sm font-semibold text-slate-700 mb-4">Tier Distribution</h3>
        <canvas id="tierChart" height="200"></canvas>
        <div class="mt-4 space-y-2">
          ${['Green','Yellow','Orange','Red'].map(tier => `
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full" style="background:${tierColors[tier]}"></div>
              <span class="text-slate-600">${tier}</span>
            </div>
            <span class="font-semibold text-slate-800">${tierCounts[tier] ?? 0}</span>
          </div>`).join('')}
        </div>
      </div>

      <div class="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100">
          <h3 class="text-sm font-semibold text-slate-700">Leader Portfolio</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-slate-100 bg-slate-50">
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Leader</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Score</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Tier</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Intervention</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Last</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">History</th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${leaderRows || '<tr><td colspan="7" class="px-4 py-8 text-center text-sm text-slate-400">No leaders yet. Add leaders above.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>

  </div>

  <!-- Invite Modal -->
  <div id="inviteModal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-slate-900">Add Leader</h3>
        <button onclick="document.getElementById('inviteModal').classList.add('hidden')"
          class="text-slate-400 hover:text-slate-600"><i class="fas fa-times"></i></button>
      </div>
      <form method="POST" action="/admin/invite" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
          <input type="text" name="name" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500" placeholder="Jane Smith">
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
          <input type="email" name="email" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500" placeholder="jane@company.com">
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1.5">Role level</label>
          <select name="role_level" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500">
            <option>C-Suite / Founder</option>
            <option>VP / SVP</option>
            <option>Director</option>
            <option>Senior Manager</option>
            <option>Manager</option>
          </select>
        </div>
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
          <i class="fas fa-info-circle mr-1"></i>
          Default password: <strong>Welcome123!</strong> — share with leader and ask them to change it.
        </div>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="document.getElementById('inviteModal').classList.add('hidden')"
            class="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-xl text-sm hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl text-sm">
            Add Leader
          </button>
        </div>
      </form>
    </div>
  </div>

  <script>
    const ctx = document.getElementById('tierChart')?.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Green', 'Yellow', 'Orange', 'Red', 'Not Assessed'],
          datasets: [{
            data: [${tierCounts.Green ?? 0}, ${tierCounts.Yellow ?? 0}, ${tierCounts.Orange ?? 0}, ${tierCounts.Red ?? 0}, ${totalLeaders - assessedLeaders}],
            backgroundColor: ['#10B981','#F59E0B','#F97316','#EF4444','#CBD5E1'],
            borderWidth: 0,
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => ctx.label + ': ' + ctx.raw } }
          },
          cutout: '65%'
        }
      });
    }
  </script>
</body>
</html>`;
}

function leaderDetailPage(leader: Record<string, unknown>, assessments: Record<string, unknown>[]): string {
  const tierColors: Record<string, string> = {
    Green: '#10B981', Yellow: '#F59E0B', Orange: '#F97316', Red: '#EF4444'
  };
  const tierBadge: Record<string, string> = {
    Green: 'bg-emerald-100 text-emerald-800',
    Yellow: 'bg-amber-100 text-amber-800',
    Orange: 'bg-orange-100 text-orange-800',
    Red: 'bg-red-100 text-red-800',
  };

  const historyRows = assessments.map((a, i) => {
    const tier = a.risk_tier as string;
    const date = new Date(a.completed_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const flags = [];
    if (a.convergence_flag) flags.push('Convergence');
    if (a.concentration_signature) flags.push('Concentration');
    if (a.drift_acceleration) flags.push('Drift');
    if (a.protective_buffer) flags.push('Buffer');
    return `
    <tr class="${i === 0 ? 'bg-blue-50/40' : 'hover:bg-slate-50'}">
      <td class="px-4 py-3 text-sm text-slate-600">${date}${i === 0 ? ' <span class="text-xs text-blue-600">(Latest)</span>' : ''}</td>
      <td class="px-4 py-3 text-sm font-bold" style="color:${tierColors[tier] ?? '#6B7280'}">${a.lsi_composite ?? '—'}</td>
      <td class="px-4 py-3">
        ${tier ? `<span class="text-xs font-semibold px-2 py-0.5 rounded-full ${tierBadge[tier] ?? ''}">${tier}</span>` : '—'}
      </td>
      <td class="px-4 py-3 text-xs text-slate-500">${flags.join(', ') || 'None'}</td>
      <td class="px-4 py-3"><a href="/assessment/${a.id}/results" class="text-xs text-blue-600 hover:underline">View Brief</a></td>
    </tr>`;
  }).join('');

  const latest = assessments[0];
  const chartData = assessments.slice(0, 8).reverse().map(a => ({
    date: new Date(a.completed_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    composite: a.lsi_composite ?? 0,
  }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${leader.name} — LSI™</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body class="bg-slate-50">
  <nav class="bg-white border-b border-slate-200 sticky top-0 z-10">
    <div class="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
      <a href="/admin" class="text-slate-400 hover:text-slate-600 text-sm"><i class="fas fa-arrow-left mr-1"></i>Portfolio</a>
      <span class="text-slate-300">/</span>
      <span class="text-sm font-semibold text-slate-800">${leader.name}</span>
    </div>
  </nav>

  <div class="max-w-5xl mx-auto px-4 py-8 space-y-6">
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-start justify-between">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
          ${(leader.name as string ?? '?').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 class="text-xl font-bold text-slate-900">${leader.name}</h1>
          <p class="text-sm text-slate-500">${leader.email} · ${leader.role_level ?? ''}</p>
          <p class="text-xs text-slate-400 mt-0.5">Member since ${new Date(leader.created_at as string).toLocaleDateString()}</p>
        </div>
      </div>
      ${latest ? `
      <div class="text-right">
        <p class="text-3xl font-bold" style="color:${tierColors[latest.risk_tier as string] ?? '#6B7280'}">${latest.lsi_composite}</p>
        <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${tierBadge[latest.risk_tier as string] ?? 'bg-slate-100 text-slate-700'} mt-1 inline-block">
          ${latest.risk_tier} — ${latest.tier_label}
        </span>
      </div>` : ''}
    </div>

    ${chartData.length > 1 ? `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h3 class="text-sm font-semibold text-slate-700 mb-4">LSI™ Composite Trajectory</h3>
      <canvas id="trendChart" height="80"></canvas>
    </div>` : ''}

    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-100">
        <h3 class="text-sm font-semibold text-slate-700">Assessment History</h3>
      </div>
      <table class="w-full">
        <thead>
          <tr class="border-b border-slate-100 bg-slate-50">
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Score</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Tier</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Signal Flags</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${historyRows || '<tr><td colspan="5" class="px-4 py-6 text-center text-sm text-slate-400">No completed assessments</td></tr>'}
        </tbody>
      </table>
    </div>
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
            backgroundColor: '#3B82F610',
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

export default admin;
