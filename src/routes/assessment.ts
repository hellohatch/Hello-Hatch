// Assessment Routes — Full 36-item instrument + scoring pipeline

import { Hono } from 'hono';
import type { Bindings, Variables } from '../types/index.js';
import { requireAuth } from '../lib/auth.js';
import { QUESTIONS, DOMAIN_META, DOMAIN_KEYS, LOAD_QUESTIONS, ORIENTATION_Q } from '../lib/questions.js';
import { computeFullRiskScore } from '../lib/scoring.js';
import { generateBriefHTML } from '../lib/brief.js';
import { computeInterventions } from '../lib/interventions.js';

const assessment = new Hono<{ Bindings: Bindings; Variables: Variables }>();
assessment.use('*', requireAuth);

// ── GET /assessment/new ──
assessment.get('/new', (c) => c.html(startPage()));

// ── POST /assessment/start ──
assessment.post('/start', async (c) => {
  const leaderId = c.get('leaderId');
  const orgId    = c.get('orgId');
  const result = await c.env.DB.prepare(
    'INSERT INTO assessments (leader_id) VALUES (?) RETURNING assessment_id'
  ).bind(leaderId).first<{ assessment_id: number }>();
  if (!result) return c.redirect('/dashboard');
  return c.redirect(`/assessment/${result.assessment_id}/take`);
});

// ── GET /assessment/:id/take ──
assessment.get('/:id/take', async (c) => {
  const leaderId     = c.get('leaderId');
  const assessmentId = parseInt(c.req.param('id'));
  const row = await c.env.DB.prepare(
    'SELECT status FROM assessments WHERE assessment_id=? AND leader_id=?'
  ).bind(assessmentId, leaderId).first<{ status: string }>();
  if (!row) return c.redirect('/dashboard');
  if (row.status === 'completed') return c.redirect(`/assessment/${assessmentId}/brief`);
  return c.html(takePage(assessmentId));
});

// ── POST /assessment/:id/submit ──
assessment.post('/:id/submit', async (c) => {
  const leaderId     = c.get('leaderId');
  const leaderName   = c.get('leaderName');
  const orgId        = c.get('orgId');
  const assessmentId = parseInt(c.req.param('id'));

  const row = await c.env.DB.prepare(
    'SELECT assessment_id, status FROM assessments WHERE assessment_id=? AND leader_id=?'
  ).bind(assessmentId, leaderId).first<{ assessment_id: number; status: string }>();
  if (!row || row.status === 'completed') return c.redirect('/dashboard');

  const body = await c.req.parseBody();

  // Collect responses
  const responsesMap = new Map<string, number>();
  const scoredQs = QUESTIONS.filter(q => q.scored);
  for (const q of scoredQs) {
    const v = parseInt(body[q.id] as string);
    if (!isNaN(v) && v >= 1 && v <= 5) responsesMap.set(q.id, v);
  }

  if (responsesMap.size < 35) {
    return c.redirect(`/assessment/${assessmentId}/take?error=complete`);
  }

  // CEI inputs (leader can provide from org data, defaults apply)
  const ceiLeader = parseInt(body.cei_leader as string) || 38;
  const ceiTotal  = parseInt(body.cei_total  as string) || 100;
  const futureOrientation = (body.Q36 as string)?.trim() ?? '';

  // Save responses
  const inserts = [];
  for (const [qId, val] of responsesMap) {
    inserts.push(
      c.env.DB.prepare('INSERT INTO assessment_responses (assessment_id,question_id,response_value) VALUES (?,?,?)')
        .bind(assessmentId, qId, val)
    );
  }
  await c.env.DB.batch(inserts);

  // Get historical risk scores for trajectory
  const historical = await c.env.DB.prepare(
    'SELECT risk_score FROM risk_scores WHERE leader_id=? ORDER BY created_at DESC LIMIT 5'
  ).bind(leaderId).all<{ risk_score: number }>();
  const historicalScores = (historical.results ?? []).map(r => r.risk_score);

  // Run scoring engine
  const scores = computeFullRiskScore(responsesMap, ceiLeader, ceiTotal, historicalScores);

  // Save risk scores (v3.1: includes lsi_norm)
  await c.env.DB.prepare(`
    INSERT INTO risk_scores (
      assessment_id, leader_id, organization_id,
      stress_regulation, cognitive_breadth, trust_climate, ethical_integrity,
      leadership_durability, adaptive_capacity,
      lsi, lsi_norm, domain_variance, signal_pattern,
      lli_raw, lli_norm,
      cei, cei_total_decisions, cei_leader_decisions,
      cascade_stage, cascade_level,
      risk_score, risk_level, trajectory_direction
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    assessmentId, leaderId, orgId,
    scores.stress_regulation, scores.cognitive_breadth,
    scores.trust_climate, scores.ethical_integrity,
    scores.leadership_durability, scores.adaptive_capacity,
    scores.lsi, scores.lsi_norm, scores.domain_variance, scores.signal_pattern,
    scores.lli_raw, scores.lli_norm,
    scores.cei, ceiTotal, ceiLeader,
    scores.cascade_stage, scores.cascade_level,
    scores.risk_score, scores.risk_level, scores.trajectory_direction
  ).run();

  // Mark assessment complete
  await c.env.DB.prepare(
    'UPDATE assessments SET status=?,completed_at=CURRENT_TIMESTAMP,future_orientation=? WHERE assessment_id=?'
  ).bind('completed', futureOrientation, assessmentId).run();

  return c.redirect(`/assessment/${assessmentId}/brief`);
});

// ── GET /assessment/:id/brief ── Executive Intelligence Brief
assessment.get('/:id/brief', async (c) => {
  const leaderId     = c.get('leaderId');
  const leaderName   = c.get('leaderName');
  const assessmentId = parseInt(c.req.param('id'));

  const row = await c.env.DB.prepare(`
    SELECT a.future_orientation, a.completed_at,
           rs.*, l.name, l.role_level,
           o.name as org_name
    FROM assessments a
    JOIN risk_scores rs ON rs.assessment_id = a.assessment_id
    JOIN leaders l ON l.leader_id = a.leader_id
    JOIN organizations o ON o.organization_id = l.organization_id
    WHERE a.assessment_id = ? AND a.leader_id = ?
  `).bind(assessmentId, leaderId).first<Record<string, unknown>>();

  if (!row) return c.redirect('/dashboard');

  const scores = {
    stress_regulation:     row.stress_regulation as number,
    cognitive_breadth:     row.cognitive_breadth as number,
    trust_climate:         row.trust_climate as number,
    ethical_integrity:     row.ethical_integrity as number,
    leadership_durability: row.leadership_durability as number,
    adaptive_capacity:     row.adaptive_capacity as number,
    lsi:                   row.lsi as number,
    lsi_norm:              (row.lsi_norm as number) ?? ((row.lsi as number) / 5),
    domain_variance:       row.domain_variance as number,
    signal_pattern:        row.signal_pattern as any,
    lli_raw:               row.lli_raw as number,
    lli_norm:              row.lli_norm as number,
    cei:                   row.cei as number,
    cascade_stage:         row.cascade_stage as any,
    cascade_level:         row.cascade_level as number,
    risk_score:            row.risk_score as number,
    risk_level:            row.risk_level as any,
    trajectory_direction:  row.trajectory_direction as any,
  };

  const historical = await c.env.DB.prepare(
    'SELECT risk_score FROM risk_scores WHERE leader_id=? AND assessment_id!=? ORDER BY created_at DESC LIMIT 5'
  ).bind(leaderId, assessmentId).all<{ risk_score: number }>();

  const historicalScores = (historical.results ?? []).map(r => r.risk_score);

  // Run Structural Intervention Engine™
  const interventionReport = computeInterventions(scores, historicalScores);

  return c.html(generateBriefHTML(
    row.name as string,
    row.org_name as string,
    row.role_level as string,
    scores,
    row.future_orientation as string ?? '',
    row.completed_at as string,
    historicalScores,
    interventionReport
  ));
});

// ─────────────────────────────────────────────
// PAGE TEMPLATES
// ─────────────────────────────────────────────

function startPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>New Assessment — LRI™</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-slate-50 min-h-screen flex items-center justify-center p-4">
  <div class="max-w-lg w-full">
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
      <div class="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <i class="fas fa-clipboard-list text-white text-2xl"></i>
      </div>
      <h1 class="text-xl font-bold text-slate-900 mb-2">Leadership Risk Intelligence™ Assessment</h1>
      <p class="text-slate-500 text-sm mb-6 leading-relaxed">
        36 items · approximately 6 minutes<br>
        30 signal questions + 5 load questions + 1 orientation question<br>
        All items reference your current experience.
      </p>
      <div class="grid grid-cols-3 gap-3 mb-7 text-center">
        <div class="bg-indigo-50 rounded-xl p-3">
          <p class="text-xl font-bold text-indigo-600">30</p>
          <p class="text-xs text-slate-500">Signal<br>Questions</p>
        </div>
        <div class="bg-amber-50 rounded-xl p-3">
          <p class="text-xl font-bold text-amber-600">5</p>
          <p class="text-xs text-slate-500">Load<br>Questions</p>
        </div>
        <div class="bg-emerald-50 rounded-xl p-3">
          <p class="text-xl font-bold text-emerald-600">1</p>
          <p class="text-xs text-slate-500">Orientation<br>Question</p>
        </div>
      </div>
      <form method="POST" action="/assessment/start">
        <button type="submit"
          class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
          Begin Assessment <i class="fas fa-arrow-right ml-2"></i>
        </button>
      </form>
      <a href="/dashboard" class="block text-center text-xs text-slate-400 hover:text-slate-600 mt-4">← Back to dashboard</a>
    </div>
  </div>
</body></html>`;
}

function takePage(assessmentId: number): string {
  const signalDomains = DOMAIN_META;

  const domainSections = signalDomains.map((meta, dIdx) => {
    const domainQs = QUESTIONS.filter(q => q.domain === meta.key);
    const qRows = domainQs.map((q, qIdx) => {
      const num = dIdx * 5 + qIdx + 1;
      return `
      <div class="q-row border border-slate-200 bg-white rounded-xl p-5 transition-all" data-qid="${q.id}" data-group="signal">
        <div class="flex items-start gap-3 mb-4">
          <span class="flex-shrink-0 w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-semibold text-slate-500">${num}</span>
          <p class="text-sm text-slate-800 leading-relaxed">${q.text}</p>
        </div>
        <div class="flex items-center justify-between gap-1">
          <span class="text-xs text-slate-400 w-20 flex-shrink-0">Never /<br>Strongly Disagree</span>
          <div class="flex gap-1.5 flex-1 justify-center">
            ${[1,2,3,4,5].map(v => `
            <label class="flex flex-col items-center cursor-pointer group">
              <input type="radio" name="${q.id}" value="${v}" required class="sr-only peer" onchange="markQ('${q.id}','signal')">
              <div class="w-10 h-10 rounded-full border-2 border-slate-200 flex items-center justify-center text-sm font-semibold text-slate-400
                peer-checked:bg-indigo-600 peer-checked:border-indigo-600 peer-checked:text-white group-hover:border-indigo-300 transition-all">
                ${v}
              </div>
            </label>`).join('')}
          </div>
          <span class="text-xs text-slate-400 w-20 flex-shrink-0 text-right">Always /<br>Strongly Agree</span>
        </div>
      </div>`;
    }).join('');

    return `
    <div class="domain-block mb-8">
      <div class="sticky top-14 z-10 bg-slate-50 py-3 mb-4 flex items-center gap-3">
        <div class="w-1 h-7 rounded-full flex-shrink-0" style="background:${meta.color}"></div>
        <div>
          <h3 class="text-sm font-bold text-slate-900">${meta.label}</h3>
          <p class="text-xs text-slate-500">${meta.description}</p>
        </div>
        <div class="ml-auto text-xs font-medium" id="dp-${meta.key}" style="color:${meta.color}">0/5</div>
      </div>
      <div class="space-y-3">${qRows}</div>
    </div>`;
  }).join('');

  const loadRows = LOAD_QUESTIONS.map((q, i) => `
  <div class="q-row border border-slate-200 bg-white rounded-xl p-5 transition-all" data-qid="${q.id}" data-group="load">
    <div class="flex items-start gap-3 mb-4">
      <span class="flex-shrink-0 w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-xs font-semibold text-amber-700">${i+1}</span>
      <p class="text-sm text-slate-800 leading-relaxed">${q.text}</p>
    </div>
    <div class="flex items-center justify-between gap-1">
      <span class="text-xs text-slate-400 w-20">Low / Never</span>
      <div class="flex gap-1.5 flex-1 justify-center">
        ${[1,2,3,4,5].map(v => `
        <label class="flex flex-col items-center cursor-pointer group">
          <input type="radio" name="${q.id}" value="${v}" required class="sr-only peer" onchange="markQ('${q.id}','load')">
          <div class="w-10 h-10 rounded-full border-2 border-slate-200 flex items-center justify-center text-sm font-semibold text-slate-400
            peer-checked:bg-amber-500 peer-checked:border-amber-500 peer-checked:text-white group-hover:border-amber-300 transition-all">
            ${v}
          </div>
        </label>`).join('')}
      </div>
      <span class="text-xs text-slate-400 w-20 text-right">High / Always</span>
    </div>
  </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Assessment — LRI™</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>.answered{border-color:#A5B4FC!important;background:#EEF2FF!important}.load-answered{border-color:#FCD34D!important;background:#FFFBEB!important}</style>
</head>
<body class="bg-slate-50">

<!-- Fixed progress bar -->
<div class="fixed top-0 left-0 right-0 z-20 bg-white border-b border-slate-200 shadow-sm">
  <div class="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
    <a href="/dashboard" class="text-slate-400 hover:text-slate-600 flex-shrink-0"><i class="fas fa-times"></i></a>
    <div class="flex-1">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-medium text-slate-600">Leadership Risk Intelligence™ Assessment</span>
        <span class="text-xs text-slate-400"><span id="answeredCount">0</span>/35 scored questions</span>
      </div>
      <div class="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div id="progressBar" class="h-full bg-indigo-500 rounded-full transition-all duration-300" style="width:0%"></div>
      </div>
    </div>
  </div>
</div>

<div class="max-w-3xl mx-auto px-4 pt-20 pb-36">
  <div class="text-center my-6">
    <h1 class="text-xl font-bold text-slate-900">Leadership Risk Intelligence™ Assessment</h1>
    <p class="text-sm text-slate-500 mt-1">Rate each item from <strong>1</strong> (Never / Strongly Disagree) to <strong>5</strong> (Always / Strongly Agree)</p>
  </div>

  <form id="assessForm" method="POST" action="/assessment/${assessmentId}/submit">

    <!-- PART 1: SIGNAL DOMAINS -->
    <div class="mb-6">
      <div class="flex items-center gap-2 mb-4">
        <div class="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">1</div>
        <h2 class="text-base font-bold text-slate-800">Leadership Signals</h2>
        <span class="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">30 questions</span>
      </div>
      ${domainSections}
    </div>

    <!-- PART 2: LOAD QUESTIONS -->
    <div class="mb-6">
      <div class="flex items-center gap-2 mb-4">
        <div class="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-bold">2</div>
        <h2 class="text-base font-bold text-slate-800">Leadership Load</h2>
        <span class="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">5 questions</span>
      </div>
      <div class="space-y-3">${loadRows}</div>
    </div>

    <!-- PART 3: CEI INPUTS -->
    <div class="mb-6 bg-white border border-slate-200 rounded-2xl p-6">
      <div class="flex items-center gap-2 mb-4">
        <div class="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">3</div>
        <h2 class="text-base font-bold text-slate-800">Decision Concentration Data</h2>
        <span class="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
      </div>
      <p class="text-xs text-slate-500 mb-4">Enter your organization's decision routing data for a precise Concentration Exposure Index™. Leave blank to use a default estimate (CEI = 0.38).</p>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="text-xs font-medium text-slate-700 block mb-1.5">Decisions resolved BY YOU (last 30 days)</label>
          <input type="number" name="cei_leader" min="0" max="1000" placeholder="e.g. 38"
            class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400">
        </div>
        <div>
          <label class="text-xs font-medium text-slate-700 block mb-1.5">TOTAL organizational decisions (last 30 days)</label>
          <input type="number" name="cei_total" min="1" max="10000" placeholder="e.g. 100"
            class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400">
        </div>
      </div>
    </div>

    <!-- PART 4: ORIENTATION (not scored) -->
    <div class="mb-6 bg-white border border-slate-200 rounded-2xl p-6">
      <div class="flex items-center gap-2 mb-3">
        <div class="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">4</div>
        <h2 class="text-base font-bold text-slate-800">Leadership Orientation</h2>
        <span class="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">Not scored</span>
      </div>
      <p class="text-sm text-slate-700 leading-relaxed mb-3">${ORIENTATION_Q.text}</p>
      <textarea name="Q36" rows="2" maxlength="300" placeholder="Your answer here..."
        class="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-400 resize-none"></textarea>
    </div>

    <!-- SUBMIT -->
    <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-xl p-4 z-20">
      <div class="max-w-3xl mx-auto flex items-center justify-between gap-4">
        <div id="submitMsg" class="text-sm text-slate-500">Answer all 35 scored questions to submit.</div>
        <button type="submit" id="submitBtn" disabled
          class="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed
            text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors">
          Generate Intelligence Brief <i class="fas fa-arrow-right ml-1"></i>
        </button>
      </div>
    </div>
  </form>
</div>

<script>
const answered = new Set();
const domainCounts = {};
const domainMeta = ${JSON.stringify(DOMAIN_META.map(d => ({ key: d.key, label: d.label })))};

function markQ(qId, group) {
  answered.add(qId);
  const row = document.querySelector('[data-qid="' + qId + '"]');
  if (row) {
    row.classList.remove('answered','load-answered');
    row.classList.add(group === 'load' ? 'load-answered' : 'answered');
  }

  // Update domain count for signal questions
  ${JSON.stringify(DOMAIN_META.map(d => d.questions)
    .reduce((acc, qs, i) => { qs.forEach(q => acc[q] = DOMAIN_META[i].key); return acc; }, {} as Record<string, string>))};
  const qDomainMap = ${JSON.stringify(
    DOMAIN_META.reduce((acc, d) => { d.questions.forEach(q => { acc[q] = d.key; }); return acc; }, {} as Record<string, string>)
  )};
  const dom = qDomainMap[qId];
  if (dom) {
    if (!domainCounts[dom]) domainCounts[dom] = new Set();
    domainCounts[dom].add(qId);
    const el = document.getElementById('dp-' + dom);
    if (el) el.textContent = domainCounts[dom].size + '/5';
  }

  const total = answered.size;
  document.getElementById('answeredCount').textContent = total;
  document.getElementById('progressBar').style.width = (total / 35 * 100) + '%';

  if (total >= 35) {
    document.getElementById('submitBtn').disabled = false;
    document.getElementById('submitMsg').textContent = '✓ All questions answered — ready to generate your brief.';
    document.getElementById('submitMsg').className = 'text-sm text-emerald-600 font-medium';
  } else {
    document.getElementById('submitMsg').textContent = (35 - total) + ' questions remaining.';
  }
}

window.addEventListener('beforeunload', (e) => {
  if (answered.size > 0 && answered.size < 35) { e.preventDefault(); e.returnValue = ''; }
});
</script>
</body></html>`;
}

export default assessment;
