// server.ts — Node.js entry point for Digital Ocean Droplet deployment
// Replaces Cloudflare Workers runtime with @hono/node-server

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Bindings, Variables } from './src/types/index.js';

import { db, runMigrations } from './src/lib/db.js';

import auth         from './src/routes/auth.js';
import assessment   from './src/routes/assessment.js';
import dashboard    from './src/routes/dashboard.js';
import org          from './src/routes/org.js';
import apiRoutes, { formulasHandler } from './src/routes/api.js';
import telemetryRoutes from './src/routes/telemetry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? '3000', 10);

// ── Run migrations on startup ─────────────────────────────────
const migrationsDir = path.join(__dirname, 'migrations');
runMigrations(migrationsDir);

// ── App ───────────────────────────────────────────────────────
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Inject SQLite DB into every request as c.env.DB
app.use('*', async (c, next) => {
  (c.env as any) = { ...(c.env ?? {}), DB: db };
  await next();
});

app.use('/api/*', cors());

// Root → dashboard
app.get('/', (c) => c.redirect('/dashboard'));

// Favicon
app.get('/favicon.ico', (c) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <rect width="32" height="32" rx="6" fill="#4F46E5"/>
    <polyline points="6,22 12,16 18,19 26,10" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="26" cy="10" r="2" fill="white"/>
  </svg>`;
  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' }
  });
});

// Health (override with Node.js version info)
app.get('/api/health', (c) => c.json({
  status: 'ok',
  platform: 'Leadership Risk Intelligence™',
  version: '3.2',
  runtime: 'node',
  environment: process.env.NODE_ENV ?? 'production',
}));

// Formulas reference
app.get('/api/formulas', (c) => c.json(formulasHandler()));

// API Docs (HTML page)
app.get('/api/docs', (c) => c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>API Documentation — LRI™</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-slate-950 text-white min-h-screen">
<nav class="border-b border-white/10 px-6 py-4 flex items-center justify-between">
  <div class="flex items-center gap-3">
    <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
      <i class="fas fa-code text-xs"></i>
    </div>
    <span class="font-bold text-sm">LRI™ API Documentation</span>
    <span class="bg-blue-600/20 text-blue-300 text-xs px-2 py-0.5 rounded-full font-medium">v3.2</span>
  </div>
  <a href="/dashboard" class="text-slate-400 hover:text-white text-xs">← Dashboard</a>
</nav>
<div class="max-w-5xl mx-auto px-6 py-10 space-y-8">
  <div>
    <h1 class="text-3xl font-bold mb-2">Leadership Risk Intelligence™ API</h1>
    <p class="text-slate-400">Programmatic access to the LRI™ scoring engine and portfolio data.</p>
  </div>
  <div class="bg-white/5 border border-white/10 rounded-xl p-5">
    <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Base URL</p>
    <code class="text-blue-300 font-mono text-sm">/api</code>
  </div>
  <div class="space-y-4">
    <div class="bg-white/5 border border-white/10 rounded-xl p-5">
      <span class="bg-green-500/20 text-green-300 text-xs font-mono px-2 py-0.5 rounded mr-2">GET</span>
      <code class="text-white font-mono text-sm">/api/health</code>
      <p class="text-slate-400 text-sm mt-2">Platform health and version check</p>
    </div>
    <div class="bg-white/5 border border-white/10 rounded-xl p-5">
      <span class="bg-green-500/20 text-green-300 text-xs font-mono px-2 py-0.5 rounded mr-2">GET</span>
      <code class="text-white font-mono text-sm">/api/formulas</code>
      <p class="text-slate-400 text-sm mt-2">Full scoring formula reference with all bands and thresholds</p>
    </div>
    <div class="bg-white/5 border border-white/10 rounded-xl p-5">
      <span class="bg-yellow-500/20 text-yellow-300 text-xs font-mono px-2 py-0.5 rounded mr-2">POST</span>
      <code class="text-white font-mono text-sm">/api/signals/calculate</code>
      <p class="text-slate-400 text-sm mt-2">Calculate LSI™ from raw question responses</p>
      <p class="text-slate-500 text-xs mt-1">Body: <code>{ responses: [{ question_id, response_value }] }</code></p>
    </div>
    <div class="bg-white/5 border border-white/10 rounded-xl p-5">
      <span class="bg-yellow-500/20 text-yellow-300 text-xs font-mono px-2 py-0.5 rounded mr-2">POST</span>
      <code class="text-white font-mono text-sm">/api/risk/calculate</code>
      <p class="text-slate-400 text-sm mt-2">Calculate Leadership Risk Score™ from computed indices</p>
      <p class="text-slate-500 text-xs mt-1">Body: <code>{ lsi, lli_norm, cei_leader_decisions, cei_total_decisions }</code></p>
    </div>
    <div class="bg-white/5 border border-white/10 rounded-xl p-5">
      <span class="bg-green-500/20 text-green-300 text-xs font-mono px-2 py-0.5 rounded mr-2">GET</span>
      <code class="text-white font-mono text-sm">/api/leader/:id/interventions</code>
      <p class="text-slate-400 text-sm mt-2">Structural Intervention Engine™ — failure patterns, prescriptions, projections (auth required)</p>
    </div>
    <div class="bg-white/5 border border-white/10 rounded-xl p-5">
      <span class="bg-green-500/20 text-green-300 text-xs font-mono px-2 py-0.5 rounded mr-2">GET</span>
      <code class="text-white font-mono text-sm">/api/org/portfolio</code>
      <p class="text-slate-400 text-sm mt-2">Organization-level portfolio risk aggregation (admin only)</p>
    </div>
  </div>
</div>
</body></html>`));

// Routes
app.route('/',              auth);
app.route('/assessment',    assessment);
app.route('/dashboard',     dashboard);
app.route('/org',           org);
app.route('/api',           apiRoutes);
app.route('/api/telemetry', telemetryRoutes);

// 404
app.notFound((c) => c.html(`
  <!DOCTYPE html><html><head><title>Not Found</title>
  <script src="https://cdn.tailwindcss.com"></script></head>
  <body class="bg-slate-50 flex items-center justify-center min-h-screen">
  <div class="text-center">
    <p class="text-6xl font-black text-slate-200">404</p>
    <p class="text-slate-500 mt-2">Page not found</p>
    <a href="/dashboard" class="mt-4 inline-block text-indigo-600 hover:underline text-sm">← Back to Dashboard</a>
  </div></body></html>
`, 404));

// ── Start ─────────────────────────────────────────────────────
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`\n🚀 Hatch LRI™ running on http://0.0.0.0:${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV ?? 'production'}`);
  console.log(`   Database    : ${process.env.DB_PATH ?? 'data/lri.db'}\n`);
});

export default app;
