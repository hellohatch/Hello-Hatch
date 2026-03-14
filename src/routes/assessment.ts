// Assessment Routes — Layer 1: Executive Input System

import { Hono } from 'hono';
import type { Bindings, Variables } from '../types/index.js';
import { requireAuth } from '../lib/auth.js';
import { QUESTIONS, CONTEXT_OPTIONS, DOMAIN_META } from '../lib/questions.js';
import { computeSignalScores, checkResponseIntegrity } from '../lib/scoring.js';

const assessment = new Hono<{ Bindings: Bindings; Variables: Variables }>();

assessment.use('*', requireAuth);

// ── GET /assessment/new ── Start new assessment
assessment.get('/new', async (c) => {
  return c.html(contextPage());
});

// ── POST /assessment/context ── Save context, begin questions
assessment.post('/context', async (c) => {
  const db = c.env.DB;
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const body = await c.req.parseBody();

  const result = await db.prepare(`
    INSERT INTO assessments (leader_id, org_id, status, role_level, org_stage, team_size, decision_volume, change_intensity, escalation_frequency)
    VALUES (?, ?, 'in_progress', ?, ?, ?, ?, ?, ?) RETURNING id
  `).bind(
    userId, orgId,
    body.role_level, body.org_stage,
    parseInt(body.team_size as string) || 10,
    body.decision_volume, body.change_intensity, body.escalation_frequency
  ).first<{ id: number }>();

  if (!result) return c.redirect('/assessment/new?error=Failed+to+start');
  return c.redirect(`/assessment/${result.id}/questions`);
});

// ── GET /assessment/:id/questions ── The 36-question form
assessment.get('/:id/questions', async (c) => {
  const db = c.env.DB;
  const userId = c.get('userId');
  const assessmentId = parseInt(c.req.param('id'));

  const row = await db.prepare(
    'SELECT * FROM assessments WHERE id = ? AND leader_id = ?'
  ).bind(assessmentId, userId).first<{ id: number; status: string; org_stage: string }>();

  if (!row) return c.redirect('/dashboard');
  if (row.status === 'completed') return c.redirect(`/assessment/${assessmentId}/results`);

  return c.html(questionsPage(assessmentId, row.org_stage));
});

// ── POST /assessment/:id/submit ── Submit answers, run scoring engine
assessment.post('/:id/submit', async (c) => {
  const db = c.env.DB;
  const userId = c.get('userId');
  const assessmentId = parseInt(c.req.param('id'));

  const row = await db.prepare(
    'SELECT * FROM assessments WHERE id = ? AND leader_id = ?'
  ).bind(assessmentId, userId).first<{
    id: number; status: string; org_stage: string; org_id: number;
  }>();

  if (!row || row.status === 'completed') return c.redirect('/dashboard');

  const body = await c.req.parseBody();

  // Build response map
  const responsesMap = new Map<string, number>();
  for (const q of QUESTIONS) {
    const val = parseInt(body[q.id] as string);
    if (!isNaN(val) && val >= 1 && val <= 7) {
      responsesMap.set(q.id, val);
    }
  }

  if (responsesMap.size < 30) {
    return c.redirect(`/assessment/${assessmentId}/questions?error=Please+answer+all+questions`);
  }

  // Integrity check
  const integrity = checkResponseIntegrity(responsesMap);

  // Save individual responses
  const responseInserts = [];
  for (const [qId, val] of responsesMap) {
    const q = QUESTIONS.find(x => x.id === qId);
    if (!q) continue;
    responseInserts.push(
      db.prepare('INSERT INTO responses (assessment_id, question_id, domain, response_value, is_anchor, is_reverse) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(assessmentId, qId, q.domain, val, q.is_anchor ? 1 : 0, q.is_reverse ? 1 : 0)
    );
  }
  await db.batch(responseInserts);

  // Run signal scoring engine
  const scores = computeSignalScores(responsesMap, row.org_stage);

  // Save signal scores
  await db.prepare(`
    INSERT INTO signal_scores (
      assessment_id, leader_id, org_id,
      operational_stability, cognitive_breadth, ethical_integrity, trust_climate, adaptive_capacity, leadership_durability,
      confidence_operational, confidence_cognitive, confidence_ethical, confidence_trust, confidence_adaptive, confidence_durability,
      lsi_composite, convergence_flag, concentration_signature, drift_acceleration, protective_buffer,
      risk_tier, tier_label, intervention_type, intervention_plan,
      operational_band, cognitive_band, ethical_band, trust_band, adaptive_band, durability_band, reason_codes
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    assessmentId, userId, row.org_id,
    scores.operational_stability.score,
    scores.cognitive_breadth.score,
    scores.ethical_integrity.score,
    scores.trust_climate.score,
    scores.adaptive_capacity.score,
    scores.leadership_durability.score,
    scores.operational_stability.confidence,
    scores.cognitive_breadth.confidence,
    scores.ethical_integrity.confidence,
    scores.trust_climate.confidence,
    scores.adaptive_capacity.confidence,
    scores.leadership_durability.confidence,
    scores.lsi_composite,
    scores.convergence_flag ? 1 : 0,
    scores.concentration_signature ? 1 : 0,
    scores.drift_acceleration ? 1 : 0,
    scores.protective_buffer ? 1 : 0,
    scores.tier,
    scores.tier_label,
    scores.intervention_type,
    JSON.stringify(scores.intervention_plan),
    scores.operational_stability.band,
    scores.cognitive_breadth.band,
    scores.ethical_integrity.band,
    scores.trust_climate.band,
    scores.adaptive_capacity.band,
    scores.leadership_durability.band,
    JSON.stringify([
      ...scores.operational_stability.reason_codes,
      ...scores.cognitive_breadth.reason_codes,
      ...scores.ethical_integrity.reason_codes,
      ...scores.trust_climate.reason_codes,
      ...scores.adaptive_capacity.reason_codes,
      ...scores.leadership_durability.reason_codes,
    ])
  ).run();

  // Update assessment status
  const status = integrity.passed ? 'completed' : 'flagged';
  await db.prepare(`
    UPDATE assessments SET status = ?, completed_at = CURRENT_TIMESTAMP,
    consistency_index = ?, extreme_responding = ?, pattern_contradiction = ?,
    low_effort_flag = ?, integrity_passed = ? WHERE id = ?
  `).bind(
    status,
    integrity.consistency_index,
    integrity.extreme_responding ? 1 : 0,
    integrity.pattern_contradiction ? 1 : 0,
    integrity.low_effort_flag ? 1 : 0,
    integrity.passed ? 1 : 0,
    assessmentId
  ).run();

  return c.redirect(`/assessment/${assessmentId}/results`);
});

// ── GET /assessment/:id/results ── The executive brief
assessment.get('/:id/results', async (c) => {
  const db = c.env.DB;
  const userId = c.get('userId');
  const userName = c.get('userName');
  const assessmentId = parseInt(c.req.param('id'));

  const row = await db.prepare(`
    SELECT a.*, s.* FROM assessments a
    JOIN signal_scores s ON s.assessment_id = a.id
    WHERE a.id = ? AND a.leader_id = ?
  `).bind(assessmentId, userId).first<Record<string, unknown>>();

  if (!row) return c.redirect('/dashboard');

  const interventionPlan = JSON.parse(row.intervention_plan as string ?? '{}');
  const reasonCodes = JSON.parse(row.reason_codes as string ?? '[]');

  return c.html(resultsPage(row, interventionPlan, reasonCodes, userName));
});

// ──────────────────────────────────────────────
// PAGE TEMPLATES
// ──────────────────────────────────────────────

function contextPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Assessment — LSI™</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-slate-50 min-h-screen">
  <div class="max-w-2xl mx-auto px-4 py-12">
    <div class="mb-8">
      <a href="/dashboard" class="text-slate-500 hover:text-slate-700 text-sm"><i class="fas fa-arrow-left mr-2"></i>Dashboard</a>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
          <i class="fas fa-clipboard-list text-white"></i>
        </div>
        <div>
          <h1 class="text-xl font-bold text-slate-900">New Signal Assessment</h1>
          <p class="text-sm text-slate-500">Context calibration — Step 1 of 2</p>
        </div>
      </div>

      <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
        <i class="fas fa-info-circle mr-2"></i>
        Context data calibrates your scores to the demands of your current role and environment. All items reference your last <strong>30–45 days</strong>.
      </div>

      <form method="POST" action="/assessment/context" class="space-y-5">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">Your current role level</label>
          <select name="role_level" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            ${CONTEXT_OPTIONS.role_level.map(r => `<option value="${r}">${r}</option>`).join('')}
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">Organization stage</label>
          <select name="org_stage" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            ${CONTEXT_OPTIONS.org_stage.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
          </select>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Team size</label>
            <select name="team_size" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500">
              <option value="3">1–5</option>
              <option value="10">6–15</option>
              <option value="30">16–50</option>
              <option value="100">51–150</option>
              <option value="200">150+</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Decision volume</label>
            <select name="decision_volume" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500">
              ${CONTEXT_OPTIONS.decision_volume.map(v => `<option value="${v.toLowerCase()}">${v}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Change intensity</label>
            <select name="change_intensity" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500">
              ${CONTEXT_OPTIONS.change_intensity.map(v => `<option value="${v.toLowerCase()}">${v}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Escalation frequency</label>
            <select name="escalation_frequency" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500">
              ${CONTEXT_OPTIONS.escalation_frequency.map(v => `<option value="${v.toLowerCase()}">${v}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="pt-4">
          <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
            Begin Assessment <i class="fas fa-arrow-right ml-2"></i>
          </button>
        </div>
      </form>
    </div>
  </div>
</body>
</html>`;
}

function questionsPage(assessmentId: number, orgStage: string): string {
  const domains = ['operational', 'cognitive', 'ethical', 'trust', 'adaptive', 'durability'];

  const domainSections = domains.map((domain, dIdx) => {
    const meta = DOMAIN_META[domain];
    const domainQs = QUESTIONS.filter(q => q.domain === domain);

    const questionRows = domainQs.map((q, qIdx) => {
      const qNum = dIdx * 6 + qIdx + 1;
      return `
      <div class="question-row border border-slate-200 rounded-xl p-5 bg-white transition-all hover:border-blue-200" data-qid="${q.id}">
        <div class="flex items-start gap-3 mb-4">
          <span class="flex-shrink-0 w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-xs font-semibold text-slate-600">${qNum}</span>
          <p class="text-sm text-slate-800 leading-relaxed">${q.text}</p>
        </div>
        <div class="flex items-center justify-between gap-1">
          <span class="text-xs text-slate-400 w-24">Strongly Disagree</span>
          <div class="flex gap-1 flex-1 justify-center">
            ${[1,2,3,4,5,6,7].map(v => `
            <label class="flex flex-col items-center cursor-pointer group">
              <input type="radio" name="${q.id}" value="${v}" required
                class="sr-only peer"
                onchange="markAnswered('${q.id}', ${v})">
              <div class="w-9 h-9 rounded-full border-2 border-slate-200 flex items-center justify-center text-xs font-medium text-slate-500
                peer-checked:bg-blue-600 peer-checked:border-blue-600 peer-checked:text-white
                group-hover:border-blue-300 transition-all select-none">
                ${v}
              </div>
            </label>`).join('')}
          </div>
          <span class="text-xs text-slate-400 w-24 text-right">Strongly Agree</span>
        </div>
      </div>`;
    }).join('');

    return `
    <div class="domain-section mb-8">
      <div class="flex items-center gap-3 mb-4 sticky top-0 bg-slate-50 py-3 z-10">
        <div class="w-1 h-8 rounded-full" style="background: ${meta.color}"></div>
        <div>
          <h3 class="font-semibold text-slate-900 text-sm">${meta.label}</h3>
          <p class="text-xs text-slate-500">${meta.description}</p>
        </div>
        <div class="ml-auto">
          <span class="domain-progress text-xs font-medium text-slate-400" id="progress-${domain}">0/6 answered</span>
        </div>
      </div>
      <div class="space-y-3">${questionRows}</div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Assessment Questions — LSI™</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    .answered { border-color: #BFDBFE !important; background: #EFF6FF !important; }
  </style>
</head>
<body class="bg-slate-50">
  <!-- Progress Bar -->
  <div class="fixed top-0 left-0 right-0 z-20 bg-white border-b border-slate-200 shadow-sm">
    <div class="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <a href="/dashboard" class="text-slate-400 hover:text-slate-600"><i class="fas fa-times"></i></a>
        <span class="text-sm font-medium text-slate-700">Leadership Signal Assessment</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-sm text-slate-500"><span id="totalAnswered">0</span>/36 answered</span>
        <div class="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div id="progressBar" class="h-full bg-blue-600 rounded-full transition-all" style="width:0%"></div>
        </div>
      </div>
    </div>
  </div>

  <div class="max-w-3xl mx-auto px-4 pt-20 pb-32">
    <div class="text-center mb-8 mt-4">
      <h1 class="text-xl font-bold text-slate-900">Signal Assessment</h1>
      <p class="text-sm text-slate-500 mt-1">Answer all 36 items honestly. All questions reference your last <strong>30–45 days</strong>.</p>
    </div>

    <form id="assessmentForm" method="POST" action="/assessment/${assessmentId}/submit">
      ${domainSections}

      <div id="submitSection" class="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg p-4">
        <div class="max-w-3xl mx-auto flex items-center justify-between">
          <div id="submitStatus" class="text-sm text-slate-500">
            Complete all 36 questions to submit.
          </div>
          <button type="submit" id="submitBtn" disabled
            class="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors">
            Submit Assessment <i class="fas fa-arrow-right ml-1"></i>
          </button>
        </div>
      </div>
    </form>
  </div>

  <script>
    const answered = new Set();
    const domainAnswered = {
      operational: new Set(), cognitive: new Set(),
      ethical: new Set(), trust: new Set(),
      adaptive: new Set(), durability: new Set()
    };
    const questionDomains = ${JSON.stringify(
      QUESTIONS.reduce((acc, q) => { acc[q.id] = q.domain; return acc; }, {} as Record<string, string>)
    )};

    function markAnswered(qId, val) {
      answered.add(qId);
      const domain = questionDomains[qId];
      if (domain) domainAnswered[domain].add(qId);

      document.querySelector('[data-qid="' + qId + '"]').classList.add('answered');

      // Update domain progress
      if (domain) {
        const count = domainAnswered[domain].size;
        const el = document.getElementById('progress-' + domain);
        if (el) el.textContent = count + '/6 answered';
        if (count === 6) el.classList.add('text-green-600');
      }

      // Update total
      const total = answered.size;
      document.getElementById('totalAnswered').textContent = total;
      document.getElementById('progressBar').style.width = (total / 36 * 100) + '%';

      if (total >= 36) {
        document.getElementById('submitBtn').disabled = false;
        document.getElementById('submitStatus').textContent = 'All questions answered. Ready to submit.';
        document.getElementById('submitStatus').className = 'text-sm text-green-600 font-medium';
      } else {
        document.getElementById('submitStatus').textContent = (36 - total) + ' questions remaining.';
      }
    }

    // Prevent accidental navigation
    window.addEventListener('beforeunload', (e) => {
      if (answered.size > 0 && answered.size < 36) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  </script>
</body>
</html>`;
}

function resultsPage(
  row: Record<string, unknown>,
  interventionPlan: Record<string, unknown>,
  reasonCodes: string[],
  userName: string
): string {
  const tierColors: Record<string, string> = {
    Green: '#10B981', Yellow: '#F59E0B', Orange: '#F97316', Red: '#EF4444'
  };
  const tierBgs: Record<string, string> = {
    Green: 'bg-emerald-50 border-emerald-200', Yellow: 'bg-amber-50 border-amber-200',
    Orange: 'bg-orange-50 border-orange-200', Red: 'bg-red-50 border-red-200'
  };
  const tierTextColors: Record<string, string> = {
    Green: 'text-emerald-800', Yellow: 'text-amber-800', Orange: 'text-orange-800', Red: 'text-red-800'
  };
  const interventionBadges: Record<string, string> = {
    preventative: 'bg-green-100 text-green-800',
    corrective: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800',
  };

  const tier = row.risk_tier as string;
  const composite = row.lsi_composite as number;
  const color = tierColors[tier] ?? '#6B7280';

  const indices = [
    { key: 'operational_stability', label: 'Operational Stability', band: row.operational_band, confidence: row.confidence_operational },
    { key: 'cognitive_breadth', label: 'Cognitive Breadth', band: row.cognitive_band, confidence: row.confidence_cognitive },
    { key: 'ethical_integrity', label: 'Ethical Integrity', band: row.ethical_band, confidence: row.confidence_ethical },
    { key: 'trust_climate', label: 'Trust Climate', band: row.trust_band, confidence: row.confidence_trust },
    { key: 'adaptive_capacity', label: 'Adaptive Capacity', band: row.adaptive_band, confidence: row.confidence_adaptive },
    { key: 'leadership_durability', label: 'Leadership Durability', band: row.durability_band, confidence: row.confidence_durability },
  ];

  const bandColors: Record<string, string> = {
    Exceptional: 'bg-emerald-100 text-emerald-800',
    Strong: 'bg-blue-100 text-blue-800',
    Adequate: 'bg-sky-100 text-sky-800',
    Developing: 'bg-amber-100 text-amber-800',
    'At-Risk': 'bg-orange-100 text-orange-800',
    Critical: 'bg-red-100 text-red-800',
  };

  const indexCards = indices.map(idx => {
    const score = row[idx.key] as number;
    const pct = score ?? 0;
    const band = idx.band as string ?? 'Developing';
    const conf = Math.round(((idx.confidence as number) ?? 0.7) * 100);
    return `
    <div class="bg-white border border-slate-200 rounded-xl p-5">
      <div class="flex items-start justify-between mb-3">
        <div>
          <p class="text-sm font-semibold text-slate-800">${idx.label}</p>
          <span class="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${bandColors[band] ?? 'bg-slate-100 text-slate-700'}">${band}</span>
        </div>
        <div class="text-right">
          <p class="text-2xl font-bold text-slate-900">${pct}</p>
          <p class="text-xs text-slate-400">${conf}% confidence</p>
        </div>
      </div>
      <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all" style="width:${pct}%; background:${color}"></div>
      </div>
    </div>`;
  }).join('');

  const selfGuided = (interventionPlan.self_guided as string[] ?? []).map((s: string) => `<li class="text-sm text-slate-700">${s}</li>`).join('');
  const facilitated = (interventionPlan.facilitated as string[] ?? []).map((s: string) => `<li class="text-sm text-slate-700">${s}</li>`).join('');
  const reasonList = (reasonCodes ?? []).filter(Boolean).map((r: string) => {
    const [code, desc] = r.split(': ');
    return `<div class="flex items-start gap-2 text-xs">
      <span class="font-mono font-semibold text-slate-500 flex-shrink-0">${code}</span>
      <span class="text-slate-600">${desc ?? ''}</span>
    </div>`;
  }).join('');

  const flags = [];
  if (row.convergence_flag) flags.push('Multi-domain convergence');
  if (row.concentration_signature) flags.push('Concentration signature');
  if (row.drift_acceleration) flags.push('Drift acceleration');
  if (row.protective_buffer) flags.push('Protective buffer active');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Assessment Results — LSI™</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body class="bg-slate-50">
  <nav class="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
    <div class="max-w-4xl mx-auto flex items-center justify-between">
      <a href="/dashboard" class="flex items-center gap-2 text-slate-600 hover:text-slate-800 text-sm font-medium">
        <i class="fas fa-arrow-left"></i> Dashboard
      </a>
      <span class="text-sm font-semibold text-slate-800">Leadership Signal Index™ — Executive Brief</span>
      <button onclick="window.print()" class="text-sm text-blue-600 hover:text-blue-800">
        <i class="fas fa-print mr-1"></i> Print
      </button>
    </div>
  </nav>

  <div class="max-w-4xl mx-auto px-4 py-8 space-y-6">

    <!-- Header Card -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div class="flex items-start justify-between">
        <div>
          <p class="text-sm text-slate-500 mb-1">Executive Brief for</p>
          <h1 class="text-2xl font-bold text-slate-900">${userName}</h1>
          <p class="text-slate-500 text-sm mt-1">
            Assessment completed ${new Date(row.completed_at as string ?? row.started_at as string).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div class="text-center bg-slate-50 rounded-2xl p-4 border border-slate-200">
          <p class="text-xs text-slate-500 mb-1">LSI™ Composite</p>
          <p class="text-4xl font-bold" style="color:${color}">${composite}</p>
          <p class="text-xs font-semibold mt-1" style="color:${color}">/100</p>
        </div>
      </div>
    </div>

    <!-- Risk Tier -->
    <div class="${tierBgs[tier] ?? 'bg-slate-50 border-slate-200'} border rounded-2xl p-6">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-3 h-3 rounded-full" style="background:${color}"></div>
        <h2 class="text-lg font-bold ${tierTextColors[tier] ?? 'text-slate-800'}">${tier} — ${row.tier_label}</h2>
        ${row.integrity_passed ? '' : '<span class="ml-auto bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-0.5 rounded-full">Response Integrity Flag</span>'}
      </div>
      ${flags.length > 0 ? `
      <div class="flex flex-wrap gap-2 mt-3">
        ${flags.map(f => `<span class="bg-white/60 border text-xs font-medium px-2.5 py-1 rounded-full text-slate-700">${f}</span>`).join('')}
      </div>` : ''}
    </div>

    <!-- Spider Chart + Scores Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 class="text-sm font-semibold text-slate-700 mb-4">Signal Profile</h3>
        <canvas id="radarChart" height="250"></canvas>
      </div>
      <div class="space-y-3">
        ${indexCards}
      </div>
    </div>

    <!-- Reason Codes -->
    ${reasonCodes.length > 0 ? `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h3 class="text-sm font-semibold text-slate-700 mb-4"><i class="fas fa-code mr-2 text-slate-400"></i>Signal Reason Codes</h3>
      <div class="space-y-2 font-mono">
        ${reasonList}
      </div>
    </div>` : ''}

    <!-- Intervention Window -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold text-slate-700">Intervention Window</h3>
        <span class="text-xs font-semibold px-3 py-1 rounded-full ${interventionBadges[interventionPlan.type as string] ?? 'bg-slate-100 text-slate-700'} capitalize">
          ${interventionPlan.type}
        </span>
      </div>
      <h4 class="font-bold text-slate-900 mb-1">${interventionPlan.title}</h4>
      <p class="text-sm text-slate-600 mb-5">${interventionPlan.description}</p>
      ${interventionPlan.urgency_note ? `<div class="bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg p-3 mb-4">${interventionPlan.urgency_note}</div>` : ''}

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Self-Guided Actions</p>
          <ul class="space-y-2 list-none">
            ${(interventionPlan.self_guided as string[] ?? []).map((s: string) => `
            <li class="flex items-start gap-2 text-sm text-slate-700">
              <i class="fas fa-check-circle text-blue-400 mt-0.5 flex-shrink-0"></i>
              ${s}
            </li>`).join('')}
          </ul>
        </div>
        <div>
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Facilitated Options</p>
          <ul class="space-y-2">
            ${(interventionPlan.facilitated as string[] ?? []).map((s: string) => `
            <li class="flex items-start gap-2 text-sm text-slate-700">
              <i class="fas fa-users text-purple-400 mt-0.5 flex-shrink-0"></i>
              ${s}
            </li>`).join('')}
          </ul>
        </div>
      </div>

      <div class="mt-5 bg-slate-900 rounded-xl p-4">
        <p class="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-1">Advisory Engagement Option</p>
        <p class="text-sm text-slate-300">${interventionPlan.advisory_option}</p>
      </div>
    </div>

    <div class="text-center py-6">
      <a href="/dashboard" class="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
        <i class="fas fa-arrow-left"></i> Back to Dashboard
      </a>
    </div>
  </div>

  <script>
    const ctx = document.getElementById('radarChart').getContext('2d');
    new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Operational\\nStability', 'Cognitive\\nBreadth', 'Ethical\\nIntegrity', 'Trust\\nClimate', 'Adaptive\\nCapacity', 'Leadership\\nDurability'],
        datasets: [{
          label: 'Your Signal Profile',
          data: [
            ${row.operational_stability},
            ${row.cognitive_breadth},
            ${row.ethical_integrity},
            ${row.trust_climate},
            ${row.adaptive_capacity},
            ${row.leadership_durability}
          ],
          backgroundColor: '${color}22',
          borderColor: '${color}',
          borderWidth: 2,
          pointBackgroundColor: '${color}',
          pointRadius: 4,
        }]
      },
      options: {
        responsive: true,
        scales: {
          r: {
            min: 0, max: 100,
            ticks: { stepSize: 25, font: { size: 9 } },
            grid: { color: '#E2E8F0' },
            pointLabels: { font: { size: 9 } }
          }
        },
        plugins: { legend: { display: false } }
      }
    });
  </script>
</body>
</html>`;
}

export default assessment;
