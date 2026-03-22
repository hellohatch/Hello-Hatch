// src/routes/hatch_admin.ts
// Hatch Super Admin — God-mode cross-organization platform view

import { Hono } from 'hono';
import type { Bindings, Variables } from '../types/index.js';
import { requireHatchAdmin, hashPassword } from '../lib/auth.js';

const hatchAdmin = new Hono<{ Bindings: Bindings; Variables: Variables }>();
hatchAdmin.use('*', requireHatchAdmin);

// ── MAIN PLATFORM DASHBOARD ──────────────────────────────────
hatchAdmin.get('/', async (c) => {
  const adminName = c.get('leaderName');
  const error   = c.req.query('error');
  const success = c.req.query('success');

  const stats = await c.env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM organizations WHERE name != 'Hatch Internal') as total_orgs,
      (SELECT COUNT(*) FROM leaders WHERE system_role != 'hatch_admin') as total_leaders,
      (SELECT COUNT(*) FROM assessments WHERE status='completed') as total_assessments,
      (SELECT COUNT(*) FROM leaders WHERE system_role = 'hatch_admin') as hatch_admins,
      (SELECT COUNT(*) FROM leaders WHERE system_role = 'admin') as org_admins,
      (SELECT COUNT(*) FROM leaders WHERE system_role = 'leader') as leaders_count
  `).first<Record<string, number>>();

  const orgs = await c.env.DB.prepare(`
    SELECT
      o.organization_id, o.name, o.industry, o.employee_count, o.created_at,
      COUNT(DISTINCT l.leader_id) as leader_count,
      COUNT(DISTINCT CASE WHEN l.system_role = 'admin' THEN l.leader_id END) as admin_count,
      COUNT(DISTINCT a.assessment_id) as assessment_count,
      MAX(a.completed_at) as last_activity,
      AVG(rs.risk_score) as avg_risk
    FROM organizations o
    LEFT JOIN leaders l ON l.organization_id = o.organization_id AND l.system_role != 'hatch_admin'
    LEFT JOIN assessments a ON a.leader_id = l.leader_id AND a.status = 'completed'
    LEFT JOIN risk_scores rs ON rs.assessment_id = a.assessment_id
    WHERE o.name != 'Hatch Internal'
    GROUP BY o.organization_id
    ORDER BY o.created_at DESC
  `).all<Record<string, unknown>>();

  const recentLeaders = await c.env.DB.prepare(`
    SELECT l.name, l.email, l.system_role, l.role_level, l.created_at, o.name as org_name
    FROM leaders l
    LEFT JOIN organizations o ON o.organization_id = l.organization_id
    WHERE l.system_role != 'hatch_admin'
    ORDER BY l.created_at DESC LIMIT 8
  `).all<Record<string, unknown>>();

  return c.html(platformDashboard(adminName, stats ?? {}, orgs.results ?? [], recentLeaders.results ?? [], error, success));
});

// ── VIEW SPECIFIC ORG ─────────────────────────────────────────
hatchAdmin.get('/org/:orgId', async (c) => {
  const orgId     = parseInt(c.req.param('orgId'));
  const adminName = c.get('leaderName');
  const error     = c.req.query('error');
  const success   = c.req.query('success');

  const org = await c.env.DB.prepare('SELECT * FROM organizations WHERE organization_id=?').bind(orgId).first<Record<string, unknown>>();
  if (!org) return c.redirect('/hatch-admin');

  const leaders = await c.env.DB.prepare(`
    SELECT l.leader_id, l.name, l.email, l.role_level, l.system_role, l.created_at,
      rs.risk_score, rs.risk_level, rs.cascade_stage, rs.lsi, rs.lli_norm, rs.cei,
      a.completed_at
    FROM leaders l
    LEFT JOIN (
      SELECT leader_id, MAX(completed_at) as completed_at, assessment_id
      FROM assessments WHERE status='completed' GROUP BY leader_id
    ) a ON a.leader_id = l.leader_id
    LEFT JOIN risk_scores rs ON rs.assessment_id = a.assessment_id
    WHERE l.organization_id = ? AND l.system_role != 'hatch_admin'
    ORDER BY CASE l.role_level
      WHEN 'C-Suite / Founder' THEN 1 WHEN 'VP / SVP' THEN 2
      WHEN 'Director' THEN 3 WHEN 'Senior Manager' THEN 4 ELSE 5 END
  `).bind(orgId).all<Record<string, unknown>>();

  return c.html(orgDetailPage(adminName, org, leaders.results ?? [], error, success));
});

// ── CREATE ORGANIZATION ───────────────────────────────────────
hatchAdmin.post('/org/create', async (c) => {
  const body     = await c.req.parseBody();
  const name     = (body.name as string)?.trim();
  const industry = (body.industry as string) || 'Other';
  if (!name) return c.redirect('/hatch-admin?error=Organization+name+required');
  const existing = await c.env.DB.prepare('SELECT organization_id FROM organizations WHERE name=?').bind(name).first();
  if (existing) return c.redirect('/hatch-admin?error=Organization+name+already+exists');
  await c.env.DB.prepare('INSERT INTO organizations (name,industry,employee_count) VALUES (?,?,?)').bind(name, industry, 0).run();
  return c.redirect('/hatch-admin?success=Organization+created+successfully');
});

// ── ADD USER TO ORG ───────────────────────────────────────────
hatchAdmin.post('/org/:orgId/add-user', async (c) => {
  const orgId    = parseInt(c.req.param('orgId'));
  const body     = await c.req.parseBody();
  const name     = (body.name as string)?.trim();
  const email    = (body.email as string)?.toLowerCase().trim();
  const password = (body.password as string) || 'Welcome2026!';
  const role     = (body.system_role as string) || 'admin';
  const level    = (body.role_level as string) || 'C-Suite / Founder';
  if (!name || !email) return c.redirect(`/hatch-admin/org/${orgId}?error=Name+and+email+required`);
  const existing = await c.env.DB.prepare('SELECT leader_id FROM leaders WHERE email=?').bind(email).first();
  if (existing) return c.redirect(`/hatch-admin/org/${orgId}?error=Email+already+registered`);
  const hash = await hashPassword(password);
  await c.env.DB.prepare('INSERT INTO leaders (organization_id,name,email,role_level,system_role,password_hash) VALUES (?,?,?,?,?,?)').bind(orgId, name, email, level, role, hash).run();
  return c.redirect(`/hatch-admin/org/${orgId}?success=User+added+successfully`);
});

// ── DELETE ORGANIZATION ───────────────────────────────────────
hatchAdmin.post('/org/:orgId/delete', async (c) => {
  const orgId = parseInt(c.req.param('orgId'));
  const org = await c.env.DB.prepare('SELECT name FROM organizations WHERE organization_id=?').bind(orgId).first<{ name: string }>();
  if (!org || org.name === 'Hatch Internal') return c.redirect('/hatch-admin?error=Cannot+delete+this+organization');
  await c.env.DB.prepare('DELETE FROM organizations WHERE organization_id=?').bind(orgId).run();
  return c.redirect('/hatch-admin?success=Organization+deleted');
});

// ── CREATE HATCH ADMIN USER ───────────────────────────────────
hatchAdmin.post('/create-hatch-admin', async (c) => {
  const body     = await c.req.parseBody();
  const name     = (body.name as string)?.trim();
  const email    = (body.email as string)?.toLowerCase().trim();
  const password = body.password as string;
  if (!name || !email || !password) return c.redirect('/hatch-admin?error=All+fields+required');
  if (password.length < 8) return c.redirect('/hatch-admin?error=Password+minimum+8+characters');
  const existing = await c.env.DB.prepare('SELECT leader_id FROM leaders WHERE email=?').bind(email).first();
  if (existing) return c.redirect('/hatch-admin?error=Email+already+registered');
  const hash = await hashPassword(password);
  let hatchOrg = await c.env.DB.prepare('SELECT organization_id FROM organizations WHERE name=?').bind('Hatch Internal').first<{ organization_id: number }>();
  if (!hatchOrg) {
    hatchOrg = await c.env.DB.prepare('INSERT INTO organizations (name,industry,employee_count) VALUES (?,?,?) RETURNING organization_id').bind('Hatch Internal','Technology',0).first<{ organization_id: number }>();
  }
  await c.env.DB.prepare('INSERT INTO leaders (organization_id,name,email,role_level,system_role,password_hash) VALUES (?,?,?,?,?,?)').bind(hatchOrg!.organization_id, name, email, 'C-Suite / Founder', 'hatch_admin', hash).run();
  return c.redirect('/hatch-admin?success=Hatch+Admin+account+created');
});

// ══════════════════════════════════════════════════════════════
// HTML TEMPLATES
// ══════════════════════════════════════════════════════════════

function platformDashboard(
  adminName: string,
  stats: Record<string, number>,
  orgs: Record<string, unknown>[],
  recent: Record<string, unknown>[],
  error?: string,
  success?: string
): string {
  const rColors: Record<string, string> = {
    'Low Structural Risk': '#10B981', 'Early Exposure': '#84CC16',
    'Emerging Dependency': '#F59E0B', 'Structural Bottleneck': '#F97316',
    'Organizational Drag': '#EF4444',
  };

  const orgRows = orgs.map(o => {
    const avgRisk = o.avg_risk as number | null;
    const rColor  = avgRisk != null ? (avgRisk > 0.15 ? '#EF4444' : avgRisk > 0.08 ? '#F97316' : '#10B981') : '#CBD5E1';
    const lastAct = o.last_activity ? new Date(o.last_activity as string).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
    return `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="px-5 py-3.5">
        <div>
          <a href="/hatch-admin/org/${o.organization_id}" class="text-sm font-semibold text-slate-800 hover:text-indigo-600">${o.name}</a>
          <p class="text-xs text-slate-400 mt-0.5">${o.industry ?? '—'}</p>
        </div>
      </td>
      <td class="px-5 py-3.5 text-sm text-slate-600">${o.leader_count ?? 0}</td>
      <td class="px-5 py-3.5">
        <span class="text-xs px-2 py-0.5 rounded-full font-medium ${(o.admin_count as number) > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}">${o.admin_count ?? 0} admin${(o.admin_count as number) !== 1 ? 's' : ''}</span>
      </td>
      <td class="px-5 py-3.5 text-sm text-slate-600">${o.assessment_count ?? 0}</td>
      <td class="px-5 py-3.5">
        ${avgRisk != null ? `<span class="text-sm font-bold" style="color:${rColor}">${(avgRisk as number).toFixed(3)}</span>` : '<span class="text-xs text-slate-400">No data</span>'}
      </td>
      <td class="px-5 py-3.5 text-xs text-slate-400">${lastAct}</td>
      <td class="px-5 py-3.5">
        <div class="flex items-center gap-2">
          <a href="/hatch-admin/org/${o.organization_id}" class="text-xs text-indigo-600 hover:underline font-medium">View</a>
          <form method="POST" action="/hatch-admin/org/${o.organization_id}/delete" onsubmit="return confirm('Delete ${o.name}? This cannot be undone.')">
            <button type="submit" class="text-xs text-red-400 hover:text-red-600">Delete</button>
          </form>
        </div>
      </td>
    </tr>`;
  }).join('');

  const recentRows = recent.map(l => `
    <div class="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${l.system_role === 'admin' ? 'bg-indigo-500' : 'bg-slate-400'}">
          ${(l.name as string).charAt(0).toUpperCase()}
        </div>
        <div>
          <p class="text-xs font-semibold text-slate-800">${l.name}</p>
          <p class="text-xs text-slate-400">${l.org_name ?? '—'}</p>
        </div>
      </div>
      <span class="text-xs px-2 py-0.5 rounded-full font-medium ${l.system_role === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}">${l.system_role}</span>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Hatch Admin — Platform Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-slate-50 min-h-screen">

<!-- NAV -->
<nav style="background:linear-gradient(135deg,#0f172a,#1e1b4b)" class="sticky top-0 z-10 shadow-lg">
  <div class="max-w-7xl mx-auto px-5 py-3.5 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow">
        <i class="fas fa-chart-line text-white text-sm"></i>
      </div>
      <div>
        <span class="font-bold text-white text-sm tracking-tight">Leadership Risk Intelligence™</span>
        <span class="ml-2 text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full font-semibold">Hatch Admin</span>
      </div>
    </div>
    <div class="flex items-center gap-4">
      <span class="text-slate-400 text-xs"><i class="fas fa-shield-halved mr-1 text-indigo-400"></i>${adminName}</span>
      <a href="/logout" class="text-xs text-slate-400 hover:text-red-400 transition-colors"><i class="fas fa-sign-out-alt mr-1"></i>Logout</a>
    </div>
  </div>
</nav>

<div class="max-w-7xl mx-auto px-5 py-7 space-y-6">

  ${error ? `<div class="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2"><i class="fas fa-circle-exclamation"></i>${decodeURIComponent(error)}</div>` : ''}
  ${success ? `<div class="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2"><i class="fas fa-circle-check"></i>${decodeURIComponent(success)}</div>` : ''}

  <!-- HEADER -->
  <div class="flex items-start justify-between flex-wrap gap-3">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Platform Command Center</h1>
      <p class="text-slate-500 text-sm mt-0.5">Hatch Super Admin · Full cross-organization access</p>
    </div>
    <div class="flex gap-2">
      <button onclick="document.getElementById('newOrgModal').classList.remove('hidden')"
        class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
        <i class="fas fa-building"></i> New Organization
      </button>
      <button onclick="document.getElementById('newHatchAdminModal').classList.remove('hidden')"
        class="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
        <i class="fas fa-shield-halved"></i> Add Hatch Admin
      </button>
    </div>
  </div>

  <!-- KPI ROW -->
  <div class="grid grid-cols-2 md:grid-cols-6 gap-4">
    ${[
      { label: 'Organizations', value: stats.total_orgs ?? 0, color: '#6366F1', icon: 'building' },
      { label: 'Total Leaders', value: stats.total_leaders ?? 0, color: '#10B981', icon: 'users' },
      { label: 'Org Admins', value: stats.org_admins ?? 0, color: '#F59E0B', icon: 'user-shield' },
      { label: 'Leaders', value: stats.leaders_count ?? 0, color: '#8B5CF6', icon: 'user' },
      { label: 'Assessments', value: stats.total_assessments ?? 0, color: '#3B82F6', icon: 'clipboard-check' },
      { label: 'Hatch Admins', value: stats.hatch_admins ?? 0, color: '#EF4444', icon: 'shield-halved' },
    ].map(s => `
    <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div class="flex items-center justify-between mb-2">
        <p class="text-xs text-slate-400">${s.label}</p>
        <i class="fas fa-${s.icon} text-xs" style="color:${s.color}"></i>
      </div>
      <p class="text-2xl font-black" style="color:${s.color}">${s.value}</p>
    </div>`).join('')}
  </div>

  <!-- MAIN CONTENT: ORG TABLE + RECENT ACTIVITY -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

    <!-- Organizations Table -->
    <div class="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 class="text-sm font-bold text-slate-800"><i class="fas fa-building mr-2 text-indigo-500"></i>All Organizations</h2>
        <span class="text-xs text-slate-400">${orgs.length} orgs</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead><tr class="border-b border-slate-100 bg-slate-50">
            <th class="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Organization</th>
            <th class="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Users</th>
            <th class="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Role</th>
            <th class="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Assessments</th>
            <th class="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Avg Risk</th>
            <th class="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Last Active</th>
            <th class="px-5 py-3"></th>
          </tr></thead>
          <tbody class="divide-y divide-slate-100">
            ${orgRows || '<tr><td colspan="7" class="px-5 py-10 text-center text-sm text-slate-400">No organizations yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Right Panel: Recent Signups + Access Levels -->
    <div class="space-y-5">

      <!-- Recent Signups -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h3 class="text-sm font-bold text-slate-800 mb-4"><i class="fas fa-user-plus mr-2 text-green-500"></i>Recent Signups</h3>
        ${recentRows || '<p class="text-xs text-slate-400 text-center py-4">No users yet</p>'}
      </div>

      <!-- Access Level Legend -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h3 class="text-sm font-bold text-slate-800 mb-4"><i class="fas fa-layer-group mr-2 text-slate-500"></i>Access Levels</h3>
        <div class="space-y-3">
          <div class="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
            <div class="w-7 h-7 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <i class="fas fa-shield-halved text-white text-xs"></i>
            </div>
            <div>
              <p class="text-xs font-bold text-red-700">Hatch Admin</p>
              <p class="text-xs text-red-600 mt-0.5">You · Full platform access · All orgs · God mode</p>
            </div>
          </div>
          <div class="flex items-start gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
            <div class="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <i class="fas fa-user-shield text-white text-xs"></i>
            </div>
            <div>
              <p class="text-xs font-bold text-indigo-700">Org Admin</p>
              <p class="text-xs text-indigo-600 mt-0.5">Client org admin · Full access within their org only</p>
            </div>
          </div>
          <div class="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div class="w-7 h-7 bg-slate-400 rounded-lg flex items-center justify-center flex-shrink-0">
              <i class="fas fa-user text-white text-xs"></i>
            </div>
            <div>
              <p class="text-xs font-bold text-slate-700">Leader</p>
              <p class="text-xs text-slate-500 mt-0.5">Individual leader · Own dashboard + assessments only</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>

</div>

<!-- NEW ORG MODAL -->
<div id="newOrgModal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
    <div class="flex items-center justify-between mb-5">
      <h3 class="font-bold text-slate-900">Create New Organization</h3>
      <button onclick="document.getElementById('newOrgModal').classList.add('hidden')" class="text-slate-400 hover:text-slate-600"><i class="fas fa-times"></i></button>
    </div>
    <form method="POST" action="/hatch-admin/org/create" class="space-y-3">
      <div>
        <label class="text-xs font-medium text-slate-700 block mb-1.5">Organization name</label>
        <input type="text" name="name" required class="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 text-slate-900" placeholder="Acme Corp">
      </div>
      <div>
        <label class="text-xs font-medium text-slate-700 block mb-1.5">Industry</label>
        <select name="industry" class="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 text-slate-900">
          <option>Technology</option><option>Healthcare</option><option>Financial Services</option>
          <option>Professional Services</option><option>Manufacturing</option><option>Education</option>
          <option>Non-profit</option><option>Other</option>
        </select>
      </div>
      <div class="flex gap-3 pt-1">
        <button type="button" onclick="document.getElementById('newOrgModal').classList.add('hidden')" class="flex-1 border border-slate-300 text-slate-600 font-medium py-2.5 rounded-xl text-sm">Cancel</button>
        <button type="submit" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl text-sm">Create</button>
      </div>
    </form>
  </div>
</div>

<!-- NEW HATCH ADMIN MODAL -->
<div id="newHatchAdminModal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
    <div class="flex items-center justify-between mb-5">
      <h3 class="font-bold text-slate-900">Add Hatch Admin</h3>
      <button onclick="document.getElementById('newHatchAdminModal').classList.add('hidden')" class="text-slate-400 hover:text-slate-600"><i class="fas fa-times"></i></button>
    </div>
    <form method="POST" action="/hatch-admin/create-hatch-admin" class="space-y-3">
      <div>
        <label class="text-xs font-medium text-slate-700 block mb-1.5">Full name</label>
        <input type="text" name="name" required class="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 text-slate-900" placeholder="Jane Smith">
      </div>
      <div>
        <label class="text-xs font-medium text-slate-700 block mb-1.5">Email</label>
        <input type="email" name="email" required class="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 text-slate-900" placeholder="jane@hellohatch.com">
      </div>
      <div>
        <label class="text-xs font-medium text-slate-700 block mb-1.5">Password (min 8 chars)</label>
        <input type="password" name="password" required minlength="8" class="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 text-slate-900">
      </div>
      <div class="flex gap-3 pt-1">
        <button type="button" onclick="document.getElementById('newHatchAdminModal').classList.add('hidden')" class="flex-1 border border-slate-300 text-slate-600 font-medium py-2.5 rounded-xl text-sm">Cancel</button>
        <button type="submit" class="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-medium py-2.5 rounded-xl text-sm">Create Admin</button>
      </div>
    </form>
  </div>
</div>

</body></html>`;
}

function orgDetailPage(
  adminName: string,
  org: Record<string, unknown>,
  leaders: Record<string, unknown>[],
  error?: string,
  success?: string
): string {
  const rColors: Record<string, string> = {
    'Low Structural Risk': '#10B981', 'Early Exposure': '#84CC16',
    'Emerging Dependency': '#F59E0B', 'Structural Bottleneck': '#F97316',
    'Organizational Drag': '#EF4444',
  };

  const rows = leaders.map(l => {
    const rs     = l.risk_score as number | null;
    const rColor = rs != null ? (rColors[l.risk_level as string] ?? '#6B7280') : '#CBD5E1';
    const date   = l.completed_at ? new Date(l.completed_at as string).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—';
    const init   = (l.name as string).split(' ').map((n:string)=>n[0]).join('').substring(0,2).toUpperCase();
    return `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="px-4 py-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style="background:${rColor}22;color:${rColor}">${init}</div>
          <div>
            <p class="text-sm font-semibold text-slate-800">${l.name}</p>
            <p class="text-xs text-slate-400">${l.email}</p>
          </div>
        </div>
      </td>
      <td class="px-4 py-3 text-xs text-slate-500">${l.role_level}</td>
      <td class="px-4 py-3">
        <span class="text-xs px-2 py-0.5 rounded-full font-medium ${l.system_role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}">${l.system_role}</span>
      </td>
      <td class="px-4 py-3">
        ${rs != null ? `<span class="text-sm font-black" style="color:${rColor}">${rs.toFixed(3)}</span>` : '<span class="text-xs text-slate-400">—</span>'}
      </td>
      <td class="px-4 py-3"><span class="text-xs font-medium" style="color:${rColor}">${rs != null ? l.risk_level : '—'}</span></td>
      <td class="px-4 py-3 text-xs text-slate-400">${date}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${org.name} — Hatch Admin View</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-slate-50 min-h-screen">

<nav style="background:linear-gradient(135deg,#0f172a,#1e1b4b)" class="sticky top-0 z-10 shadow-lg">
  <div class="max-w-7xl mx-auto px-5 py-3.5 flex items-center gap-3">
    <a href="/hatch-admin" class="text-slate-400 hover:text-white text-sm transition-colors"><i class="fas fa-arrow-left mr-1"></i>Platform</a>
    <span class="text-slate-600">/</span>
    <span class="text-white text-sm font-semibold">${org.name}</span>
    <span class="ml-2 text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full">Hatch Admin View</span>
    <div class="ml-auto flex items-center gap-4">
      <span class="text-slate-400 text-xs"><i class="fas fa-shield-halved mr-1 text-indigo-400"></i>${adminName}</span>
      <a href="/logout" class="text-xs text-slate-400 hover:text-red-400"><i class="fas fa-sign-out-alt"></i></a>
    </div>
  </div>
</nav>

<div class="max-w-7xl mx-auto px-5 py-7 space-y-5">

  ${error ? `<div class="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm"><i class="fas fa-circle-exclamation mr-2"></i>${decodeURIComponent(error)}</div>` : ''}
  ${success ? `<div class="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm"><i class="fas fa-circle-check mr-2"></i>${decodeURIComponent(success)}</div>` : ''}

  <div class="flex items-start justify-between flex-wrap gap-3">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">${org.name}</h1>
      <p class="text-slate-500 text-sm mt-0.5">${org.industry ?? '—'} · ${leaders.length} users</p>
    </div>
    <button onclick="document.getElementById('addUserModal').classList.remove('hidden')"
      class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl">
      <i class="fas fa-user-plus"></i> Add User to Org
    </button>
  </div>

  <!-- KPIs -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    ${[
      { label: 'Total Users', value: leaders.length, color: '#6366F1' },
      { label: 'Org Admins', value: leaders.filter(l=>l.system_role==='admin').length, color: '#F59E0B' },
      { label: 'Assessed', value: leaders.filter(l=>l.risk_score!=null).length, color: '#10B981' },
      { label: 'Avg Risk', value: leaders.filter(l=>l.risk_score!=null).length > 0 ? (leaders.filter(l=>l.risk_score!=null).reduce((s,l)=>s+(l.risk_score as number),0)/leaders.filter(l=>l.risk_score!=null).length).toFixed(3) : '—', color: '#EF4444' },
    ].map(k=>`
    <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <p class="text-xs text-slate-400 mb-1">${k.label}</p>
      <p class="text-2xl font-black" style="color:${k.color}">${k.value}</p>
    </div>`).join('')}
  </div>

  <!-- Leaders Table -->
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div class="px-5 py-4 border-b border-slate-100">
      <h2 class="text-sm font-bold text-slate-800">All Users in ${org.name}</h2>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead><tr class="border-b border-slate-100 bg-slate-50">
          <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">User</th>
          <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Job Level</th>
          <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Platform Role</th>
          <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Risk Score</th>
          <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Risk Level</th>
          <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Last Assessed</th>
        </tr></thead>
        <tbody class="divide-y divide-slate-100">
          ${rows || '<tr><td colspan="6" class="px-4 py-10 text-center text-sm text-slate-400">No users yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>

</div>

<!-- Add User Modal -->
<div id="addUserModal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
    <div class="flex items-center justify-between mb-5">
      <h3 class="font-bold text-slate-900">Add User to ${org.name}</h3>
      <button onclick="document.getElementById('addUserModal').classList.add('hidden')" class="text-slate-400 hover:text-slate-600"><i class="fas fa-times"></i></button>
    </div>
    <form method="POST" action="/hatch-admin/org/${org.organization_id}/add-user" class="space-y-3">
      <div>
        <label class="text-xs font-medium text-slate-700 block mb-1.5">Full name</label>
        <input type="text" name="name" required class="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500" placeholder="Jane Smith">
      </div>
      <div>
        <label class="text-xs font-medium text-slate-700 block mb-1.5">Email</label>
        <input type="email" name="email" required class="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500" placeholder="jane@company.com">
      </div>
      <div>
        <label class="text-xs font-medium text-slate-700 block mb-1.5">Platform role</label>
        <select name="system_role" class="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900">
          <option value="admin">Org Admin — full org access</option>
          <option value="leader">Leader — own dashboard only</option>
        </select>
      </div>
      <div>
        <label class="text-xs font-medium text-slate-700 block mb-1.5">Job level</label>
        <select name="role_level" class="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900">
          <option>C-Suite / Founder</option><option>VP / SVP</option>
          <option>Director</option><option>Senior Manager</option><option>Manager</option>
        </select>
      </div>
      <div>
        <label class="text-xs font-medium text-slate-700 block mb-1.5">Temp password (default: Welcome2026!)</label>
        <input type="text" name="password" class="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900" placeholder="Welcome2026!">
      </div>
      <div class="flex gap-3 pt-1">
        <button type="button" onclick="document.getElementById('addUserModal').classList.add('hidden')" class="flex-1 border border-slate-300 text-slate-600 font-medium py-2.5 rounded-xl text-sm">Cancel</button>
        <button type="submit" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl text-sm">Add User</button>
      </div>
    </form>
  </div>
</div>

</body></html>`;
}

export default hatchAdmin;
