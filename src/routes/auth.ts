// Auth Routes — Login, Register, Logout

import { Hono } from 'hono';
import type { Bindings, Variables } from '../types/index.js';
import { hashPassword, verifyPassword, createToken, setSessionCookie, clearSessionCookie } from '../lib/auth.js';

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ── GET /login ──
auth.get('/login', (c) => {
  const error = c.req.query('error');
  return c.html(loginPage(error));
});

// ── POST /login ──
auth.post('/login', async (c) => {
  const db = c.env.DB;
  const body = await c.req.parseBody();
  const email = (body.email as string)?.toLowerCase().trim();
  const password = body.password as string;

  if (!email || !password) {
    return c.redirect('/login?error=Missing+credentials');
  }

  const user = await db.prepare(
    'SELECT id, org_id, name, role, role_level, password_hash FROM users WHERE email = ?'
  ).bind(email).first<{
    id: number; org_id: number; name: string;
    role: string; role_level: string; password_hash: string;
  }>();

  if (!user) return c.redirect('/login?error=Invalid+email+or+password');

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return c.redirect('/login?error=Invalid+email+or+password');

  const token = createToken({
    userId: user.id,
    orgId: user.org_id,
    role: user.role,
    name: user.name,
  });

  setSessionCookie(c, token);

  if (user.role === 'admin') {
    return c.redirect('/admin');
  }
  return c.redirect('/dashboard');
});

// ── GET /register ──
auth.get('/register', (c) => {
  const error = c.req.query('error');
  return c.html(registerPage(error));
});

// ── POST /register ──
auth.post('/register', async (c) => {
  const db = c.env.DB;
  const body = await c.req.parseBody();
  const name = (body.name as string)?.trim();
  const email = (body.email as string)?.toLowerCase().trim();
  const password = body.password as string;
  const orgName = (body.org_name as string)?.trim();
  const roleLevel = body.role_level as string;

  if (!name || !email || !password || !orgName) {
    return c.redirect('/register?error=All+fields+are+required');
  }

  if (password.length < 8) {
    return c.redirect('/register?error=Password+must+be+at+least+8+characters');
  }

  // Check if email taken
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return c.redirect('/register?error=Email+already+registered');

  const hash = await hashPassword(password);

  // Create org + user in one transaction
  const orgResult = await db.prepare(
    'INSERT INTO organizations (name, type) VALUES (?, ?) RETURNING id'
  ).bind(orgName, 'enterprise').first<{ id: number }>();

  if (!orgResult) return c.redirect('/register?error=Failed+to+create+organization');

  const userResult = await db.prepare(
    'INSERT INTO users (org_id, email, name, role, role_level, password_hash) VALUES (?, ?, ?, ?, ?, ?) RETURNING id'
  ).bind(orgResult.id, email, name, 'admin', roleLevel ?? 'C-Suite / Founder', hash).first<{ id: number }>();

  if (!userResult) return c.redirect('/register?error=Failed+to+create+account');

  const token = createToken({
    userId: userResult.id,
    orgId: orgResult.id,
    role: 'admin',
    name,
  });

  setSessionCookie(c, token);
  return c.redirect('/admin');
});

// ── GET /logout ──
auth.get('/logout', (c) => {
  clearSessionCookie(c);
  return c.redirect('/login');
});

// ──────────────────────────────────────────────
// PAGE TEMPLATES
// ──────────────────────────────────────────────

function loginPage(error?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login — Leadership Signal Index™</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 min-h-screen flex items-center justify-center">
  <div class="w-full max-w-md px-6">
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
        <i class="fas fa-chart-line text-white text-2xl"></i>
      </div>
      <h1 class="text-2xl font-bold text-white">Leadership Signal Index™</h1>
      <p class="text-slate-400 text-sm mt-1">Risk Intelligence Platform</p>
    </div>

    <div class="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-2xl">
      <h2 class="text-lg font-semibold text-white mb-6">Sign in to your account</h2>

      ${error ? `<div class="bg-red-500/20 border border-red-500/40 text-red-300 text-sm rounded-lg px-4 py-3 mb-5 flex items-center gap-2"><i class="fas fa-exclamation-circle"></i> ${decodeURIComponent(error)}</div>` : ''}

      <form method="POST" action="/login" class="space-y-4">
        <div>
          <label class="block text-sm text-slate-300 mb-1.5">Email address</label>
          <input type="email" name="email" required
            class="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="you@company.com">
        </div>
        <div>
          <label class="block text-sm text-slate-300 mb-1.5">Password</label>
          <input type="password" name="password" required
            class="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••">
        </div>
        <button type="submit"
          class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors mt-2">
          Sign In <i class="fas fa-arrow-right ml-1"></i>
        </button>
      </form>

      <p class="text-center text-slate-400 text-sm mt-6">
        New organization?
        <a href="/register" class="text-blue-400 hover:text-blue-300 font-medium ml-1">Create account</a>
      </p>
    </div>

    <p class="text-center text-slate-600 text-xs mt-6">
      Demo: admin@demo.com / password123
    </p>
  </div>
</body>
</html>`;
}

function registerPage(error?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Register — Leadership Signal Index™</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 min-h-screen flex items-center justify-center py-10">
  <div class="w-full max-w-md px-6">
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
        <i class="fas fa-chart-line text-white text-2xl"></i>
      </div>
      <h1 class="text-2xl font-bold text-white">Leadership Signal Index™</h1>
      <p class="text-slate-400 text-sm mt-1">Create your organization account</p>
    </div>

    <div class="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-2xl">
      <h2 class="text-lg font-semibold text-white mb-6">Get started</h2>

      ${error ? `<div class="bg-red-500/20 border border-red-500/40 text-red-300 text-sm rounded-lg px-4 py-3 mb-5 flex items-center gap-2"><i class="fas fa-exclamation-circle"></i> ${decodeURIComponent(error)}</div>` : ''}

      <form method="POST" action="/register" class="space-y-4">
        <div>
          <label class="block text-sm text-slate-300 mb-1.5">Your full name</label>
          <input type="text" name="name" required
            class="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Jane Smith">
        </div>
        <div>
          <label class="block text-sm text-slate-300 mb-1.5">Organization name</label>
          <input type="text" name="org_name" required
            class="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Acme Corp">
        </div>
        <div>
          <label class="block text-sm text-slate-300 mb-1.5">Role level</label>
          <select name="role_level"
            class="w-full bg-slate-800 border border-white/20 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option>C-Suite / Founder</option>
            <option>VP / SVP</option>
            <option>Director</option>
            <option>Senior Manager</option>
            <option>Manager</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-slate-300 mb-1.5">Email address</label>
          <input type="email" name="email" required
            class="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="you@company.com">
        </div>
        <div>
          <label class="block text-sm text-slate-300 mb-1.5">Password</label>
          <input type="password" name="password" required minlength="8"
            class="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Minimum 8 characters">
        </div>
        <button type="submit"
          class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors mt-2">
          Create Account <i class="fas fa-arrow-right ml-1"></i>
        </button>
      </form>

      <p class="text-center text-slate-400 text-sm mt-6">
        Already have an account?
        <a href="/login" class="text-blue-400 hover:text-blue-300 font-medium ml-1">Sign in</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export default auth;
