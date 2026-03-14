// Auth Routes

import { Hono } from 'hono';
import type { Bindings, Variables } from '../types/index.js';
import { hashPassword, verifyPassword, createToken, setSession, clearSession } from '../lib/auth.js';

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

auth.get('/login', (c) => {
  const error = c.req.query('error');
  return c.html(loginPage(error));
});

auth.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const email    = (body.email    as string)?.toLowerCase().trim();
  const password = body.password  as string;
  if (!email || !password) return c.redirect('/login?error=Missing+credentials');

  const user = await c.env.DB.prepare(
    'SELECT leader_id,organization_id,name,system_role,password_hash FROM leaders WHERE email=?'
  ).bind(email).first<{ leader_id:number; organization_id:number; name:string; system_role:string; password_hash:string }>();

  if (!user || !(await verifyPassword(password, user.password_hash)))
    return c.redirect('/login?error=Invalid+email+or+password');

  setSession(c, createToken({ leaderId: user.leader_id, orgId: user.organization_id, role: user.system_role, name: user.name }));
  return c.redirect(user.system_role === 'admin' ? '/org' : '/dashboard');
});

auth.get('/register', (c) => c.html(registerPage(c.req.query('error'))));

auth.post('/register', async (c) => {
  const body = await c.req.parseBody();
  const name     = (body.name     as string)?.trim();
  const email    = (body.email    as string)?.toLowerCase().trim();
  const password = body.password  as string;
  const orgName  = (body.org_name as string)?.trim();
  const roleLevel= body.role_level as string;
  const industry = body.industry   as string;

  if (!name || !email || !password || !orgName) return c.redirect('/register?error=All+fields+required');
  if (password.length < 8) return c.redirect('/register?error=Password+minimum+8+characters');

  const existing = await c.env.DB.prepare('SELECT leader_id FROM leaders WHERE email=?').bind(email).first();
  if (existing) return c.redirect('/register?error=Email+already+registered');

  const hash = await hashPassword(password);

  const org = await c.env.DB.prepare(
    'INSERT INTO organizations (name,industry,employee_count) VALUES (?,?,?) RETURNING organization_id'
  ).bind(orgName, industry ?? 'Other', 100).first<{ organization_id: number }>();
  if (!org) return c.redirect('/register?error=Failed+to+create+organization');

  const leader = await c.env.DB.prepare(
    'INSERT INTO leaders (organization_id,name,email,role_level,system_role,password_hash) VALUES (?,?,?,?,?,?) RETURNING leader_id'
  ).bind(org.organization_id, name, email, roleLevel ?? 'C-Suite / Founder', 'admin', hash)
    .first<{ leader_id: number }>();
  if (!leader) return c.redirect('/register?error=Failed+to+create+account');

  setSession(c, createToken({ leaderId: leader.leader_id, orgId: org.organization_id, role: 'admin', name }));
  return c.redirect('/org');
});

auth.get('/logout', (c) => { clearSession(c); return c.redirect('/login'); });

// ─────────────────────────────────────────────
function loginPage(error?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Sign In — Leadership Risk Intelligence™</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 min-h-screen flex items-center justify-center p-4">
  <div class="w-full max-w-sm">
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-xl">
        <i class="fas fa-chart-line text-white text-xl"></i>
      </div>
      <p class="text-white font-bold text-xl tracking-tight">Leadership Risk Intelligence™</p>
      <p class="text-slate-400 text-xs mt-1">Hatch Platform</p>
    </div>
    <div class="bg-white/8 backdrop-blur border border-white/12 rounded-2xl p-7 shadow-2xl">
      <h2 class="text-white font-semibold text-base mb-5">Sign in</h2>
      ${error ? `<div class="bg-red-500/20 border border-red-500/30 text-red-300 text-xs rounded-lg px-3 py-2.5 mb-4 flex items-center gap-2"><i class="fas fa-circle-exclamation"></i>${decodeURIComponent(error)}</div>` : ''}
      <form method="POST" action="/login" class="space-y-4">
        <div>
          <label class="text-xs text-slate-300 block mb-1.5">Email</label>
          <input type="email" name="email" required placeholder="you@company.com"
            class="w-full bg-white/8 border border-white/15 text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="text-xs text-slate-300 block mb-1.5">Password</label>
          <input type="password" name="password" required placeholder="••••••••"
            class="w-full bg-white/8 border border-white/15 text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <button type="submit" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors mt-1">
          Sign In <i class="fas fa-arrow-right ml-1 text-xs"></i>
        </button>
      </form>
      <p class="text-center text-slate-500 text-xs mt-5">
        New organization? <a href="/register" class="text-blue-400 hover:text-blue-300">Create account</a>
      </p>
    </div>
    <p class="text-center text-slate-700 text-xs mt-5">Demo: admin@demo.com / password123</p>
  </div>
</body></html>`;
}

function registerPage(error?: string): string {
  const industries = ['Technology','Healthcare','Financial Services','Professional Services','Manufacturing','Education','Non-profit','Other'];
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Register — Leadership Risk Intelligence™</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 min-h-screen flex items-center justify-center p-4 py-10">
  <div class="w-full max-w-sm">
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-xl">
        <i class="fas fa-chart-line text-white text-xl"></i>
      </div>
      <p class="text-white font-bold text-xl tracking-tight">Leadership Risk Intelligence™</p>
      <p class="text-slate-400 text-xs mt-1">Create your organization</p>
    </div>
    <div class="bg-white/8 backdrop-blur border border-white/12 rounded-2xl p-7 shadow-2xl">
      ${error ? `<div class="bg-red-500/20 border border-red-500/30 text-red-300 text-xs rounded-lg px-3 py-2.5 mb-4 flex items-center gap-2"><i class="fas fa-circle-exclamation"></i>${decodeURIComponent(error)}</div>` : ''}
      <form method="POST" action="/register" class="space-y-3.5">
        <div>
          <label class="text-xs text-slate-300 block mb-1.5">Your full name</label>
          <input type="text" name="name" required placeholder="Jane Smith"
            class="w-full bg-white/8 border border-white/15 text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="text-xs text-slate-300 block mb-1.5">Organization name</label>
          <input type="text" name="org_name" required placeholder="Acme Corp"
            class="w-full bg-white/8 border border-white/15 text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="text-xs text-slate-300 block mb-1.5">Industry</label>
          <select name="industry" class="w-full bg-slate-800 border border-white/15 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            ${industries.map(i => `<option>${i}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-slate-300 block mb-1.5">Your role level</label>
          <select name="role_level" class="w-full bg-slate-800 border border-white/15 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option>C-Suite / Founder</option><option>VP / SVP</option>
            <option>Director</option><option>Senior Manager</option><option>Manager</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-slate-300 block mb-1.5">Email</label>
          <input type="email" name="email" required placeholder="you@company.com"
            class="w-full bg-white/8 border border-white/15 text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="text-xs text-slate-300 block mb-1.5">Password (min 8 chars)</label>
          <input type="password" name="password" required minlength="8" placeholder="••••••••"
            class="w-full bg-white/8 border border-white/15 text-white placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <button type="submit" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors mt-1">
          Create Account <i class="fas fa-arrow-right ml-1 text-xs"></i>
        </button>
      </form>
      <p class="text-center text-slate-500 text-xs mt-5">
        Already registered? <a href="/login" class="text-blue-400 hover:text-blue-300">Sign in</a>
      </p>
    </div>
  </div>
</body></html>`;
}

export default auth;
