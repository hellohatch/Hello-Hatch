// Leadership Signal Index™ — Main Application Entry Point

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Bindings, Variables } from './types/index.js';

// Route modules
import auth from './routes/auth.js';
import assessment from './routes/assessment.js';
import dashboard from './routes/dashboard.js';
import admin from './routes/admin.js';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware
app.use('*', logger());
app.use('/api/*', cors());

// ── Root redirect ──
app.get('/', (c) => c.redirect('/dashboard'));

// ── Route modules ──
app.route('/', auth);
app.route('/assessment', assessment);
app.route('/dashboard', dashboard);
app.route('/admin', admin);

// ── API: Health check ──
app.get('/api/health', (c) => c.json({ status: 'ok', service: 'Leadership Signal Index™', version: '1.0.0' }));

// ── API: Get tier definitions ──
app.get('/api/tiers', (c) => {
  return c.json({
    tiers: [
      { tier: 'Green', label: 'Leadership Ready', range: [75, 100], description: 'Signal integrity high. No concentration or drift detected.' },
      { tier: 'Yellow', label: 'Monitor & Develop', range: [55, 74], description: 'Domain softness detected. Preventative attention warranted.' },
      { tier: 'Orange', label: 'Active Intervention', range: [35, 54], description: 'Concentration signatures detected. Corrective intervention recommended.' },
      { tier: 'Red', label: 'Critical Risk', range: [0, 34], description: 'Acute convergence of risk signals. Urgent advisory engagement required.' },
    ]
  });
});

// ── 404 handler ──
app.notFound((c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>404 — LSI™</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-50 min-h-screen flex items-center justify-center">
  <div class="text-center">
    <p class="text-6xl font-bold text-slate-200 mb-4">404</p>
    <p class="text-slate-600 mb-6">Page not found</p>
    <a href="/dashboard" class="text-blue-600 hover:underline text-sm">← Back to Dashboard</a>
  </div>
</body>
</html>`, 404);
});

export default app;
