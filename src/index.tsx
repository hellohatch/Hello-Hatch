// Leadership Risk Intelligence™ Platform — Main App Entry (v3.0)

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings, Variables } from './types/index.js';

import auth       from './routes/auth.js';
import assessment from './routes/assessment.js';
import dashboard  from './routes/dashboard.js';
import org        from './routes/org.js';
import apiRoutes  from './routes/api.js';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

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

// Route modules
app.route('/',           auth);
app.route('/assessment', assessment);
app.route('/dashboard',  dashboard);
app.route('/org',        org);
app.route('/api',        apiRoutes);

// API: health
app.get('/api/health', (c) => c.json({
  status: 'ok',
  platform: 'Leadership Risk Intelligence™',
  version: '3.0',
  owner: 'Hatch',
  timestamp: new Date().toISOString(),
}));

// API: scoring formula reference
app.get('/api/formulas', (c) => c.json({
  description: 'Leadership Risk Intelligence™ v3.0 Scoring Formulas',
  models: {
    LSI: {
      name: 'Leadership Signal Index™',
      formula: 'LSI = (SR + CB + TC + EI + LD + AC) / 6',
      range: '1.0 – 5.0',
      domains: ['Stress Regulation (SR)', 'Cognitive Breadth (CB)', 'Trust Climate (TC)',
                'Ethical Integrity (EI)', 'Leadership Durability (LD)', 'Adaptive Capacity (AC)'],
      domain_formula: 'Domain Score = Sum(domain responses) / 5',
      questions: '30 signal questions (5 per domain)',
    },
    LLI: {
      name: 'Leadership Load Index™',
      formula_raw:  'LLI_raw = Sum(load_responses) / 5',
      formula_norm: 'LLI_norm = (LLI_raw - 1) / 4',
      range_raw:  '1.0 – 5.0',
      range_norm: '0.0 – 1.0',
      questions: '5 load questions',
    },
    CEI: {
      name: 'Concentration Exposure Index™',
      formula: 'CEI = leader_decisions / total_decisions',
      range: '0.0 – 1.0',
      thresholds: {
        '0.00–0.30': 'Healthy Distribution',
        '0.31–0.45': 'Emerging Exposure',
        '0.46–0.65': 'Structural Dependency',
        '0.66–0.80': 'Decision Bottleneck',
        '0.81–1.00': 'Organizational Drag',
      },
    },
    LRS: {
      name: 'Leadership Risk Score™',
      formula: 'Risk Score = (CEI × LLI_norm) / LSI',
      risk_bands: {
        '0.000–0.050': 'Low structural risk',
        '0.051–0.100': 'Early exposure',
        '0.101–0.200': 'Emerging dependency',
        '0.201–0.350': 'Structural bottleneck',
        '> 0.350':     'Organizational risk',
      },
    },
  },
  signal_patterns: [
    'Organizational Stabilizer',
    'Strategic Interpreter',
    'Structural Bottleneck Risk',
    'Leadership Load Saturation',
  ],
}));

// API docs
app.get('/api/docs', (c) => c.html(apiDocsPage()));

// 404
app.notFound((c) => c.html(`<!DOCTYPE html>
<html><head><title>404</title><script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-slate-50 min-h-screen flex items-center justify-center">
  <div class="text-center">
    <p class="text-6xl font-black text-slate-200">404</p>
    <p class="text-slate-500 mt-2 mb-4">Page not found</p>
    <a href="/dashboard" class="text-indigo-600 hover:underline text-sm">← Dashboard</a>
  </div>
</body></html>`, 404));

function apiDocsPage(): string {
  return `<!DOCTYPE html>
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
    <span class="bg-blue-600/20 text-blue-300 text-xs px-2 py-0.5 rounded-full font-medium">v3.0</span>
  </div>
  <a href="/dashboard" class="text-slate-400 hover:text-white text-xs">← Dashboard</a>
</nav>
<div class="max-w-5xl mx-auto px-6 py-10 space-y-8">

  <div>
    <h1 class="text-3xl font-bold mb-2">Leadership Risk Intelligence™ API</h1>
    <p class="text-slate-400">Programmatic access to the LRI™ scoring engine, risk calculation, and portfolio data.</p>
  </div>

  <!-- Base URL -->
  <div class="bg-white/5 border border-white/10 rounded-xl p-5">
    <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Base URL</p>
    <code class="text-blue-300 font-mono text-sm">/api</code>
  </div>

  <!-- Endpoints -->
  ${[
    {
      method: 'GET', path: '/api/health',
      desc: 'Platform health check',
      response: '{ status, platform, version, owner, timestamp }',
    },
    {
      method: 'GET', path: '/api/formulas',
      desc: 'Full scoring formula reference with all bands and thresholds',
      response: '{ models: { LSI, LLI, CEI, LRS }, signal_patterns }',
    },
    {
      method: 'POST', path: '/api/signals/calculate',
      desc: 'Calculate Leadership Signal Index™ from raw responses',
      body: '{ responses: [{ question_id: "Q01", response_value: 4 }] }',
      response: '{ domain_scores, lsi, lli_norm, signal_pattern, domain_variance }',
    },
    {
      method: 'POST', path: '/api/risk/calculate',
      desc: 'Calculate Leadership Risk Score™ from computed indices',
      body: '{ lsi, lli_norm, cei_leader_decisions, cei_total_decisions }',
      response: '{ cei, cascade_stage, risk_score, risk_level, trajectory_direction }',
    },
    {
      method: 'GET', path: '/api/leader/:id/brief',
      desc: 'Retrieve structured executive brief data for a leader (auth required)',
      auth: true,
      response: '{ leader, assessment, scores, history, formulas }',
    },
    {
      method: 'GET', path: '/api/org/portfolio',
      desc: 'Organization-level portfolio risk aggregation (admin only)',
      auth: true,
      response: '{ portfolio_metrics, risk_distribution, cascade_distribution, leaders }',
    },
    {
      method: 'POST', path: '/api/decisions/ingest',
      desc: 'Ingest decision routing events for CEI calculation (admin only)',
      auth: true,
      body: '{ events: [{ leader_id, total_decisions, leader_decisions }] }',
      response: '{ success, ingested }',
    },
  ].map(ep => `
  <div class="bg-white/5 border border-white/10 rounded-xl p-5">
    <div class="flex items-start justify-between flex-wrap gap-3 mb-3">
      <div class="flex items-center gap-3">
        <span class="px-2 py-0.5 rounded font-mono text-xs font-bold ${ep.method === 'GET' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'}">${ep.method}</span>
        <code class="font-mono text-sm text-white">${ep.path}</code>
        ${ep.auth ? '<span class="text-xs text-amber-400"><i class="fas fa-lock mr-1"></i>Auth</span>' : ''}
      </div>
    </div>
    <p class="text-sm text-slate-400 mb-3">${ep.desc}</p>
    ${ep.body ? `<div class="mb-2"><p class="text-xs text-slate-500 mb-1">Request Body:</p><code class="text-xs text-slate-300 font-mono bg-black/30 px-3 py-2 rounded-lg block">${ep.body}</code></div>` : ''}
    <div><p class="text-xs text-slate-500 mb-1">Response:</p><code class="text-xs text-slate-300 font-mono bg-black/30 px-3 py-2 rounded-lg block">${ep.response}</code></div>
  </div>`).join('')}

  <!-- Scoring Reference -->
  <div class="bg-white/5 border border-white/10 rounded-xl p-6">
    <h2 class="font-bold text-base mb-4">Scoring Formula Reference</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-sm">
      <div class="space-y-2">
        <p class="text-slate-400 text-xs uppercase tracking-wider font-sans mb-2">Signal Formulas</p>
        <p><span class="text-blue-400">Domain Score</span> = Σ(responses) / n</p>
        <p><span class="text-purple-400">LSI</span> = (SR+CB+TC+EI+LD+AC) / 6</p>
        <p><span class="text-amber-400">LLI_raw</span> = Σ(load) / 5</p>
        <p><span class="text-amber-400">LLI_norm</span> = (LLI_raw − 1) / 4</p>
      </div>
      <div class="space-y-2">
        <p class="text-slate-400 text-xs uppercase tracking-wider font-sans mb-2">Risk Formulas</p>
        <p><span class="text-orange-400">CEI</span> = leader_dec / total_dec</p>
        <p><span class="text-red-400">Risk Score</span> = (CEI × LLI_norm) / LSI</p>
      </div>
    </div>
  </div>

</div>
</body></html>`;
}

export default app;
