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
  return c.redirect(user.system_role === 'hatch_admin' ? '/hatch-admin' : user.system_role === 'admin' ? '/org' : '/dashboard');
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
<body style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; font-family: system-ui, -apple-system, sans-serif;">
  <div style="width: 100%; max-width: 380px;">
    <div style="text-align: center; margin-bottom: 2rem;">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background: #2563eb; border-radius: 16px; margin-bottom: 1rem; box-shadow: 0 20px 40px rgba(37,99,235,0.4);">
        <i class="fas fa-chart-line" style="color: white; font-size: 1.25rem;"></i>
      </div>
      <p style="color: white; font-weight: 700; font-size: 1.125rem; letter-spacing: -0.02em;">Leadership Risk Intelligence™</p>
      <p style="color: #94a3b8; font-size: 0.75rem; margin-top: 0.25rem;">Hatch Platform</p>
    </div>
    <div style="background: white; border-radius: 20px; padding: 2rem; box-shadow: 0 25px 50px rgba(0,0,0,0.5);">
      <h2 style="color: #1e293b; font-weight: 700; font-size: 1.125rem; margin-bottom: 1.5rem;">Sign in</h2>
      ${error ? `<div style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; font-size: 0.75rem; border-radius: 8px; padding: 0.625rem 0.875rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;"><i class="fas fa-circle-exclamation"></i>${decodeURIComponent(error)}</div>` : ''}
      <form method="POST" action="/login">
        <div style="margin-bottom: 1rem;">
          <label style="display: block; color: #475569; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.375rem;">Email</label>
          <input type="email" name="email" required placeholder="you@company.com"
            style="width: 100%; background: #f8fafc; border: 1.5px solid #e2e8f0; color: #0f172a; border-radius: 10px; padding: 0.625rem 0.875rem; font-size: 0.875rem; box-sizing: border-box; outline: none;"
            onfocus="this.style.borderColor='#2563eb'; this.style.boxShadow='0 0 0 3px rgba(37,99,235,0.1)';"
            onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none';">
        </div>
        <div style="margin-bottom: 1.5rem;">
          <label style="display: block; color: #475569; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.375rem;">Password</label>
          <input type="password" name="password" required placeholder="••••••••"
            style="width: 100%; background: #f8fafc; border: 1.5px solid #e2e8f0; color: #0f172a; border-radius: 10px; padding: 0.625rem 0.875rem; font-size: 0.875rem; box-sizing: border-box; outline: none;"
            onfocus="this.style.borderColor='#2563eb'; this.style.boxShadow='0 0 0 3px rgba(37,99,235,0.1)';"
            onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none';">
        </div>
        <button type="submit"
          style="width: 100%; background: #2563eb; color: white; font-weight: 600; font-size: 0.875rem; padding: 0.75rem; border: none; border-radius: 10px; cursor: pointer; transition: background 0.2s;"
          onmouseover="this.style.background='#1d4ed8';" onmouseout="this.style.background='#2563eb';">
          Sign In &rarr;
        </button>
      </form>
      <p style="text-align: center; color: #94a3b8; font-size: 0.75rem; margin-top: 1.25rem;">
        New organization? <a href="/register" style="color: #2563eb; text-decoration: none; font-weight: 600;">Create account</a>
      </p>
    </div>
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
<body style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem 1rem; font-family: system-ui, -apple-system, sans-serif;">
  <div style="width: 100%; max-width: 380px;">
    <div style="text-align: center; margin-bottom: 2rem;">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background: #2563eb; border-radius: 16px; margin-bottom: 1rem; box-shadow: 0 20px 40px rgba(37,99,235,0.4);">
        <i class="fas fa-chart-line" style="color: white; font-size: 1.25rem;"></i>
      </div>
      <p style="color: white; font-weight: 700; font-size: 1.125rem; letter-spacing: -0.02em;">Leadership Risk Intelligence™</p>
      <p style="color: #94a3b8; font-size: 0.75rem; margin-top: 0.25rem;">Create your organization</p>
    </div>
    <div style="background: white; border-radius: 20px; padding: 2rem; box-shadow: 0 25px 50px rgba(0,0,0,0.5);">
      ${error ? `<div style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; font-size: 0.75rem; border-radius: 8px; padding: 0.625rem 0.875rem; margin-bottom: 1rem;"><i class="fas fa-circle-exclamation" style="margin-right:0.375rem;"></i>${decodeURIComponent(error)}</div>` : ''}
      <form method="POST" action="/register">
        <div style="margin-bottom: 0.875rem;">
          <label style="display: block; color: #475569; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.375rem;">Your full name</label>
          <input type="text" name="name" required placeholder="Jane Smith"
            style="width: 100%; background: #f8fafc; border: 1.5px solid #e2e8f0; color: #0f172a; border-radius: 10px; padding: 0.625rem 0.875rem; font-size: 0.875rem; box-sizing: border-box; outline: none;">
        </div>
        <div style="margin-bottom: 0.875rem;">
          <label style="display: block; color: #475569; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.375rem;">Organization name</label>
          <input type="text" name="org_name" required placeholder="Acme Corp"
            style="width: 100%; background: #f8fafc; border: 1.5px solid #e2e8f0; color: #0f172a; border-radius: 10px; padding: 0.625rem 0.875rem; font-size: 0.875rem; box-sizing: border-box; outline: none;">
        </div>
        <div style="margin-bottom: 0.875rem;">
          <label style="display: block; color: #475569; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.375rem;">Industry</label>
          <select name="industry" style="width: 100%; background: #f8fafc; border: 1.5px solid #e2e8f0; color: #0f172a; border-radius: 10px; padding: 0.625rem 0.875rem; font-size: 0.875rem; box-sizing: border-box; outline: none;">
            ${industries.map(i => `<option>${i}</option>`).join('')}
          </select>
        </div>
        <div style="margin-bottom: 0.875rem;">
          <label style="display: block; color: #475569; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.375rem;">Your role level</label>
          <select name="role_level" style="width: 100%; background: #f8fafc; border: 1.5px solid #e2e8f0; color: #0f172a; border-radius: 10px; padding: 0.625rem 0.875rem; font-size: 0.875rem; box-sizing: border-box; outline: none;">
            <option>C-Suite / Founder</option><option>VP / SVP</option>
            <option>Director</option><option>Senior Manager</option><option>Manager</option>
          </select>
        </div>
        <div style="margin-bottom: 0.875rem;">
          <label style="display: block; color: #475569; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.375rem;">Email</label>
          <input type="email" name="email" required placeholder="you@company.com"
            style="width: 100%; background: #f8fafc; border: 1.5px solid #e2e8f0; color: #0f172a; border-radius: 10px; padding: 0.625rem 0.875rem; font-size: 0.875rem; box-sizing: border-box; outline: none;">
        </div>
        <div style="margin-bottom: 1.5rem;">
          <label style="display: block; color: #475569; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.375rem;">Password (min 8 chars)</label>
          <input type="password" name="password" required minlength="8" placeholder="••••••••"
            style="width: 100%; background: #f8fafc; border: 1.5px solid #e2e8f0; color: #0f172a; border-radius: 10px; padding: 0.625rem 0.875rem; font-size: 0.875rem; box-sizing: border-box; outline: none;">
        </div>
        <button type="submit"
          style="width: 100%; background: #2563eb; color: white; font-weight: 600; font-size: 0.875rem; padding: 0.75rem; border: none; border-radius: 10px; cursor: pointer;"
          onmouseover="this.style.background='#1d4ed8';" onmouseout="this.style.background='#2563eb';">
          Create Account &rarr;
        </button>
      </form>
      <p style="text-align: center; color: #94a3b8; font-size: 0.75rem; margin-top: 1.25rem;">
        Already registered? <a href="/login" style="color: #2563eb; text-decoration: none; font-weight: 600;">Sign in</a>
      </p>
    </div>
  </div>
</body></html>`;
}

export default auth;
