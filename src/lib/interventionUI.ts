// ═══════════════════════════════════════════════════════════════════════
// Structural Intervention Engine™ — UI Renderer
// Generates HTML panels for: Leader Dashboard, Org Dashboard, Executive Brief
// ═══════════════════════════════════════════════════════════════════════

import type { InterventionReport, StructuralSignal, Intervention, RiskProjection, UrgencyLevel } from '../lib/interventions.js';
import { URGENCY_META, CONFIDENCE_META } from '../lib/interventions.js';

// ───────────────────────────────────────────────
// LEADER DASHBOARD PANEL
// Full intervention intelligence for a single leader
// ───────────────────────────────────────────────
export function renderInterventionPanel(
  report: InterventionReport,
  assessmentId: number
): string {
  if (!report.signals.length && !report.interventions.length) {
    return renderHealthyState();
  }

  const topSignal   = report.signals[0];
  const topIntv     = report.primary_intervention;
  const urgMeta     = topSignal ? URGENCY_META[topSignal.urgency as UrgencyLevel] : URGENCY_META['Monitor'];
  const escPct      = Math.round(report.escalation_probability_90d * 100);
  const tteDays     = report.time_to_next_cascade_days;

  return `
<!-- ═══ STRUCTURAL INTERVENTION ENGINE™ ═══ -->
<div class="bg-white rounded-2xl border-2 shadow-sm overflow-hidden" style="border-color:${urgMeta.borderColor}">

  <!-- Header bar -->
  <div class="px-6 py-4 flex items-center justify-between" style="background:${urgMeta.bg}">
    <div class="flex items-center gap-3">
      <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background:${urgMeta.color}22">
        <i class="fas fa-${urgMeta.icon} text-sm" style="color:${urgMeta.color}"></i>
      </div>
      <div>
        <div class="flex items-center gap-2">
          <p class="text-sm font-bold text-slate-900">Structural Intervention Engine™</p>
          <span class="text-xs font-bold px-2 py-0.5 rounded-full text-white" style="background:${urgMeta.color}">${urgMeta.label}</span>
          ${report.is_compound ? '<span class="text-xs font-bold px-2 py-0.5 rounded-full bg-red-800 text-white">Compound Failure</span>' : ''}
        </div>
        <p class="text-xs mt-0.5" style="color:${urgMeta.color}">${report.system_recommendation}</p>
      </div>
    </div>
    <div class="text-right hidden sm:block flex-shrink-0">
      <p class="text-2xl font-black" style="color:${urgMeta.color}">${escPct}%</p>
      <p class="text-xs text-slate-500">escalation<br>probability (90d)</p>
    </div>
  </div>

  <div class="p-6 space-y-6">

    <!-- DETECTED STRUCTURAL PATTERNS -->
    <div>
      <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        <i class="fas fa-search mr-1.5"></i>Detected Structural Patterns
      </p>
      <div class="space-y-3">
        ${report.signals.map((sig, i) => renderSignalCard(sig, i === 0)).join('')}
      </div>
    </div>

    <!-- METRICS ROW: TTE + Escalation Prob + Projection delta -->
    <div class="grid grid-cols-3 gap-3">
      <div class="bg-slate-50 rounded-xl p-4 text-center">
        <p class="text-2xl font-black ${tteDays !== null && tteDays < 30 ? 'text-red-600' : tteDays !== null && tteDays < 60 ? 'text-orange-500' : 'text-slate-700'}">
          ${tteDays !== null ? tteDays + 'd' : '—'}
        </p>
        <p class="text-xs text-slate-500 mt-0.5 leading-tight">Time to<br>next cascade</p>
      </div>
      <div class="bg-slate-50 rounded-xl p-4 text-center">
        <p class="text-2xl font-black" style="color:${urgMeta.color}">${escPct}%</p>
        <p class="text-xs text-slate-500 mt-0.5 leading-tight">Escalation<br>probability (90d)</p>
      </div>
      <div class="bg-slate-50 rounded-xl p-4 text-center">
        <p class="text-2xl font-black text-emerald-600">
          ${topIntv ? topIntv.expected_risk_pct + '%' : '—'}
        </p>
        <p class="text-xs text-slate-500 mt-0.5 leading-tight">Expected risk<br>reduction</p>
      </div>
    </div>

    <!-- RISK TRAJECTORY PROJECTION -->
    ${renderProjectionChart(report.projections)}

    <!-- PRIMARY INTERVENTION -->
    ${topIntv ? renderInterventionCard(topIntv, true) : ''}

    <!-- ADDITIONAL INTERVENTIONS (collapsed) -->
    ${report.interventions.length > 1 ? `
    <div>
      <button onclick="toggleSecondaryInterventions()" class="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 transition-colors">
        <i class="fas fa-chevron-right" id="secondaryChevron"></i>
        View ${report.interventions.length - 1} additional intervention${report.interventions.length > 2 ? 's' : ''}
      </button>
      <div id="secondaryInterventions" class="hidden mt-3 space-y-3">
        ${report.interventions.slice(1).map(intv => renderInterventionCard(intv, false)).join('')}
      </div>
    </div>` : ''}

    <!-- COST OF INACTION -->
    <div class="bg-slate-900 rounded-xl p-4">
      <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        <i class="fas fa-exclamation-triangle mr-1.5 text-amber-400"></i>Cost of Inaction
      </p>
      <p class="text-sm text-slate-300 leading-relaxed">${report.estimated_cost_of_inaction}</p>
    </div>

  </div>
</div>

<script>
function toggleSecondaryInterventions() {
  const el = document.getElementById('secondaryInterventions');
  const ch = document.getElementById('secondaryChevron');
  if (el) {
    el.classList.toggle('hidden');
    if (ch) ch.style.transform = el.classList.contains('hidden') ? '' : 'rotate(90deg)';
  }
}
function toggleWeekPlan(id) {
  const el = document.getElementById('weekplan-' + id);
  const ch = document.getElementById('chevron-' + id);
  if (el) {
    el.classList.toggle('hidden');
    if (ch) ch.style.transform = el.classList.contains('hidden') ? '' : 'rotate(180deg)';
  }
}
</script>`;
}

// ───────────────────────────────────────────────
// SIGNAL CARD
// ───────────────────────────────────────────────
function renderSignalCard(sig: StructuralSignal, isPrimary: boolean): string {
  const confMeta = CONFIDENCE_META[sig.confidence];
  const urgMeta  = URGENCY_META[sig.urgency as UrgencyLevel];

  return `
  <div class="border rounded-xl p-4" style="border-color:${sig.color}44;background:${urgMeta.bg}">
    <div class="flex items-start gap-3">
      <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style="background:${sig.color}22">
        <i class="fas fa-${sig.icon} text-sm" style="color:${sig.color}"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="text-sm font-bold capitalize" style="color:${sig.color}">${sig.label}</p>
          ${isPrimary ? '<span class="text-xs bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full">Primary</span>' : ''}
          <span class="text-xs font-medium px-2 py-0.5 rounded-full text-white" style="background:${urgMeta.color}">${sig.urgency}</span>
        </div>
        <p class="text-xs text-slate-700 mt-1 leading-relaxed">${sig.description}</p>
        <!-- Evidence items -->
        <div class="mt-2.5 space-y-1">
          ${sig.evidence.map(e => `
          <div class="flex items-start gap-1.5">
            <i class="fas fa-arrow-right text-xs mt-0.5 flex-shrink-0" style="color:${sig.color}88"></i>
            <p class="text-xs text-slate-600">${e}</p>
          </div>`).join('')}
        </div>
        <!-- Severity bar -->
        <div class="mt-3 flex items-center gap-2">
          <span class="text-xs text-slate-400 w-14">Severity</span>
          <div class="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all" style="width:${Math.round(sig.severity*100)}%;background:${sig.color}"></div>
          </div>
          <span class="text-xs font-bold w-8 text-right" style="color:${sig.color}">${Math.round(sig.severity*100)}%</span>
          <span class="text-xs ml-1" style="color:${confMeta.color}">${sig.confidence} conf.</span>
        </div>
      </div>
    </div>
  </div>`;
}

// ───────────────────────────────────────────────
// PROJECTION CHART (Canvas-based sparkline)
// ───────────────────────────────────────────────
function renderProjectionChart(projections: RiskProjection[]): string {
  if (!projections.length) return '';

  const noAction   = projections.find(p => p.scenario === 'No Action');
  const withAction = projections.find(p => p.scenario === 'With Intervention');

  if (!noAction || !withAction) return '';

  return `
  <div class="bg-white border border-slate-200 rounded-xl p-5">
    <div class="flex items-center justify-between mb-4">
      <div>
        <p class="text-sm font-bold text-slate-800">Risk Trajectory Projection™</p>
        <p class="text-xs text-slate-400 mt-0.5">90-day modeled forecast · with vs. without structural intervention</p>
      </div>
      <div class="flex items-center gap-4 text-xs">
        <div class="flex items-center gap-1.5"><div class="w-3 h-1.5 rounded bg-red-400"></div><span class="text-slate-500">No action</span></div>
        <div class="flex items-center gap-1.5"><div class="w-3 h-1.5 rounded bg-emerald-500"></div><span class="text-slate-500">With intervention</span></div>
      </div>
    </div>
    <canvas id="projectionChart" height="120"></canvas>
    <div class="mt-3 grid grid-cols-4 gap-2 text-center">
      ${(['day_0','day_30','day_60','day_90'] as const).map((d, i) => {
        const label = ['Now','30d','60d','90d'][i];
        const na  = noAction[d];
        const wa  = withAction[d];
        const diff = parseFloat((na - wa).toFixed(4));
        return `
        <div class="bg-slate-50 rounded-lg px-2 py-2">
          <p class="text-xs text-slate-400 mb-1">${label}</p>
          <p class="text-xs font-bold text-red-500">${na.toFixed(3)}</p>
          <p class="text-xs font-bold text-emerald-600">${wa.toFixed(3)}</p>
          ${diff > 0 ? `<p class="text-xs text-indigo-600 font-semibold mt-0.5">−${diff.toFixed(3)}</p>` : ''}
        </div>`;
      }).join('')}
    </div>
  </div>
  <script>
  (function() {
    const projCtx = document.getElementById('projectionChart')?.getContext('2d');
    if (!projCtx) return;
    const labels = ['Now', '30 days', '60 days', '90 days'];
    const noActionData  = [${noAction.day_0},${noAction.day_30},${noAction.day_60},${noAction.day_90}];
    const withActData   = [${withAction.day_0},${withAction.day_30},${withAction.day_60},${withAction.day_90}];
    // Risk bands as annotations
    new Chart(projCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'No Action',
            data: noActionData,
            borderColor: '#EF4444',
            backgroundColor: '#EF444420',
            borderWidth: 2.5,
            borderDash: [5, 4],
            pointRadius: 5,
            pointBackgroundColor: '#EF4444',
            fill: false,
            tension: 0.3,
          },
          {
            label: 'With Intervention',
            data: withActData,
            borderColor: '#10B981',
            backgroundColor: '#10B98115',
            borderWidth: 2.5,
            pointRadius: 5,
            pointBackgroundColor: '#10B981',
            fill: true,
            tension: 0.3,
          },
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                const val = ctx.parsed.y;
                const band = val <= 0.030 ? 'Low' : val <= 0.080 ? 'Early' : val <= 0.150 ? 'Emerging' : val <= 0.300 ? 'Bottleneck' : 'Org Risk';
                return ctx.dataset.label + ': ' + val.toFixed(3) + ' (' + band + ')';
              }
            }
          }
        },
        scales: {
          y: {
            min: 0,
            grid: { color: '#F1F5F9' },
            ticks: { font: { size: 10 }, callback: v => v.toFixed(2) }
          },
          x: { grid: { display: false }, ticks: { font: { size: 10 } } }
        }
      }
    });
  })();
  </script>`;
}

// ───────────────────────────────────────────────
// INTERVENTION CARD
// ───────────────────────────────────────────────
function renderInterventionCard(intv: Intervention, isPrimary: boolean): string {
  const effortColors: Record<string, string> = { Low: '#10B981', Medium: '#F59E0B', High: '#EF4444' };
  const effortColor = effortColors[intv.effort] ?? '#6B7280';
  const cardId = intv.id + (isPrimary ? '-primary' : '-secondary');

  return `
  <div class="border rounded-xl overflow-hidden ${isPrimary ? 'border-indigo-200' : 'border-slate-200'}">
    <!-- Intervention header -->
    <div class="px-5 py-4 ${isPrimary ? 'bg-indigo-50' : 'bg-slate-50'} flex items-start justify-between gap-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap mb-1">
          ${isPrimary ? '<span class="text-xs font-bold text-indigo-600 uppercase tracking-wide">Primary Intervention</span>' : '<span class="text-xs font-medium text-slate-400 uppercase tracking-wide">Supporting Intervention</span>'}
          <span class="text-xs bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full">${intv.type}</span>
        </div>
        <p class="text-sm font-bold text-slate-900">${intv.title}</p>
        <p class="text-xs text-slate-600 mt-1 leading-relaxed">${intv.rationale}</p>
      </div>
      <div class="text-right flex-shrink-0">
        <p class="text-xl font-black text-emerald-600">−${intv.expected_risk_pct}%</p>
        <p class="text-xs text-slate-400">risk reduction</p>
      </div>
    </div>

    <!-- Metrics strip -->
    <div class="px-5 py-3 border-t ${isPrimary ? 'border-indigo-100' : 'border-slate-100'} grid grid-cols-4 gap-3">
      <div>
        <p class="text-xs text-slate-400">Time to escalation</p>
        <p class="text-sm font-bold text-slate-800">${intv.time_to_escalation_days}d</p>
      </div>
      <div>
        <p class="text-xs text-slate-400">Implementation</p>
        <p class="text-sm font-bold text-slate-800">${intv.implementation_weeks}w</p>
      </div>
      <div>
        <p class="text-xs text-slate-400">Effort</p>
        <p class="text-sm font-bold" style="color:${effortColor}">${intv.effort}</p>
      </div>
      <div>
        <p class="text-xs text-slate-400">Owner</p>
        <p class="text-sm font-bold text-slate-800">${intv.owner}</p>
      </div>
    </div>

    <!-- 4-week action plan (collapsible) -->
    <div class="border-t ${isPrimary ? 'border-indigo-100' : 'border-slate-100'}">
      <button onclick="toggleWeekPlan('${cardId}')"
        class="w-full px-5 py-3 flex items-center justify-between text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors">
        <span><i class="fas fa-list-check mr-1.5 text-indigo-400"></i>${intv.actions.length}-step action plan</span>
        <i class="fas fa-chevron-down transition-transform" id="chevron-${cardId}"></i>
      </button>
      <div id="weekplan-${cardId}" class="hidden">
        <div class="px-5 pb-5 space-y-2">
          ${intv.actions.map(a => `
          <div class="flex gap-3 text-xs">
            <div class="flex-shrink-0 w-16 font-bold text-indigo-600">Week ${a.week}</div>
            <div class="flex-1">
              <p class="text-slate-700">${a.action}</p>
              <p class="text-slate-400 mt-0.5"><i class="fas fa-ruler-combined mr-1"></i>${a.metric}</p>
            </div>
          </div>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

// ───────────────────────────────────────────────
// HEALTHY STATE (no signals detected)
// ───────────────────────────────────────────────
function renderHealthyState(): string {
  return `
  <div class="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6">
    <div class="flex items-center gap-4">
      <div class="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center flex-shrink-0">
        <i class="fas fa-check-circle text-emerald-600 text-xl"></i>
      </div>
      <div>
        <p class="text-sm font-bold text-emerald-900">No Structural Intervention Required</p>
        <p class="text-xs text-emerald-700 mt-1">Structural Intervention Engine™ detected no active failure patterns. All four indices are within healthy operating range. Continue quarterly monitoring.</p>
      </div>
      <div class="ml-auto hidden sm:block text-center flex-shrink-0">
        <p class="text-2xl font-black text-emerald-600">&lt;5%</p>
        <p class="text-xs text-emerald-600">escalation<br>probability</p>
      </div>
    </div>
  </div>`;
}

// ───────────────────────────────────────────────
// ORG-LEVEL INTERVENTION SUMMARY
// Compact row for each leader in the portfolio view
// ───────────────────────────────────────────────
export function renderOrgInterventionSummary(
  leaders: Array<{
    leader_id: number;
    name: string;
    role_level: string;
    report: InterventionReport | null;
    risk_score: number;
    risk_level: string;
  }>
): string {
  const active = leaders.filter(l => l.report && l.report.interventions.length > 0);
  if (!active.length) return `
  <div class="text-center py-8 text-slate-400 text-sm">
    <i class="fas fa-check-circle text-emerald-400 text-2xl mb-2 block"></i>No structural interventions required across portfolio.
  </div>`;

  return `
  <div class="space-y-2">
    ${active.sort((a, b) => (b.report!.escalation_probability_90d) - (a.report!.escalation_probability_90d))
      .map(l => {
        const rep  = l.report!;
        const topS = rep.signals[0];
        const topI = rep.primary_intervention;
        const urgM = topS ? URGENCY_META[topS.urgency as UrgencyLevel] : URGENCY_META['Monitor'];
        const escPct = Math.round(rep.escalation_probability_90d * 100);
        const tte    = rep.time_to_next_cascade_days;

        return `
        <div class="flex items-center gap-3 p-3.5 border rounded-xl transition-all hover:shadow-sm" style="border-color:${urgM.borderColor};background:${urgM.bg}">
          <!-- Avatar -->
          <div class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white" style="background:${urgM.color}">
            ${l.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
          </div>
          <!-- Name + pattern -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <a href="/org/leader/${l.leader_id}" class="text-sm font-bold text-slate-900 hover:text-indigo-600">${l.name}</a>
              <span class="text-xs text-slate-400">${l.role_level}</span>
              <span class="text-xs font-bold px-2 py-0.5 rounded-full text-white" style="background:${urgM.color}">${topS?.urgency ?? 'Monitor'}</span>
              ${rep.is_compound ? '<span class="text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-800 text-white">Compound</span>' : ''}
            </div>
            <p class="text-xs text-slate-600 mt-0.5 truncate">${topS?.label ?? 'No patterns detected'}</p>
            ${topI ? `<p class="text-xs text-indigo-600 mt-0.5"><i class="fas fa-prescription-bottle-alt mr-1"></i>${topI.title}</p>` : ''}
          </div>
          <!-- Metrics -->
          <div class="flex items-center gap-4 flex-shrink-0 text-center">
            <div>
              <p class="text-sm font-black" style="color:${urgM.color}">${escPct}%</p>
              <p class="text-xs text-slate-400">Esc. prob.</p>
            </div>
            <div>
              <p class="text-sm font-black ${tte !== null && tte < 30 ? 'text-red-600' : 'text-slate-700'}">${tte !== null ? tte + 'd' : '—'}</p>
              <p class="text-xs text-slate-400">TTE</p>
            </div>
            <div>
              <p class="text-sm font-black text-emerald-600">${topI ? '−' + topI.expected_risk_pct + '%' : '—'}</p>
              <p class="text-xs text-slate-400">If treated</p>
            </div>
            <a href="/org/leader/${l.leader_id}" class="text-xs text-indigo-600 hover:underline font-medium whitespace-nowrap">Details →</a>
          </div>
        </div>`;
      }).join('')}
  </div>`;
}

// ───────────────────────────────────────────────
// BRIEF SECTION — compact for Executive Report
// ───────────────────────────────────────────────
export function renderBriefInterventionSection(report: InterventionReport): string {
  if (!report.signals.length) {
    return `
    <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
      <i class="fas fa-check-circle text-emerald-500 mb-2 block text-xl"></i>
      <p class="text-sm font-bold text-emerald-800">Structural Intervention Engine™</p>
      <p class="text-xs text-emerald-700 mt-1">No active failure patterns detected. Quarterly monitoring recommended.</p>
    </div>`;
  }

  const topSignal = report.signals[0];
  const topIntv   = report.primary_intervention;
  const urgMeta   = URGENCY_META[topSignal.urgency as UrgencyLevel];
  const escPct    = Math.round(report.escalation_probability_90d * 100);
  const tte       = report.time_to_next_cascade_days;

  return `
  <!-- Structural Intervention Engine™ — Brief Section -->
  <div class="space-y-4">

    <!-- System recommendation box -->
    <div class="border-l-4 rounded-r-xl px-5 py-4" style="border-color:${urgMeta.color};background:${urgMeta.bg}">
      <div class="flex items-center gap-2 mb-1">
        <i class="fas fa-${urgMeta.icon}" style="color:${urgMeta.color}"></i>
        <span class="text-xs font-bold uppercase tracking-wide" style="color:${urgMeta.color}">System Recommendation · ${urgMeta.label}</span>
      </div>
      <p class="text-sm text-slate-800 leading-relaxed">${report.system_recommendation}</p>
    </div>

    <!-- Signal + intervention summary grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

      <!-- Detected patterns -->
      <div class="border border-slate-200 rounded-xl p-4">
        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Detected Patterns</p>
        <div class="space-y-2.5">
          ${report.signals.slice(0, 3).map(sig => `
          <div class="flex items-start gap-2.5">
            <div class="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style="background:${sig.color}22">
              <i class="fas fa-${sig.icon} text-xs" style="color:${sig.color}"></i>
            </div>
            <div>
              <p class="text-xs font-bold" style="color:${sig.color}">${sig.label}</p>
              <p class="text-xs text-slate-500">${sig.description}</p>
            </div>
          </div>`).join('')}
        </div>
      </div>

      <!-- Key metrics -->
      <div class="border border-slate-200 rounded-xl p-4">
        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Predictive Metrics</p>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs text-slate-600">Escalation probability (90d)</span>
            <span class="text-sm font-black" style="color:${urgMeta.color}">${escPct}%</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-xs text-slate-600">Time to next cascade stage</span>
            <span class="text-sm font-bold text-slate-800">${tte !== null ? tte + ' days' : 'Not modeled'}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-xs text-slate-600">Expected risk reduction (if treated)</span>
            <span class="text-sm font-bold text-emerald-600">${topIntv ? '−' + topIntv.expected_risk_pct + '%' : 'N/A'}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-xs text-slate-600">Active structural patterns</span>
            <span class="text-sm font-bold text-slate-800">${report.signals.length}${report.is_compound ? ' (Compound)' : ''}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Primary intervention summary -->
    ${topIntv ? `
    <div class="border border-indigo-200 bg-indigo-50 rounded-xl p-4">
      <div class="flex items-center justify-between mb-2">
        <p class="text-xs font-bold text-indigo-700 uppercase tracking-wide">Prescribed Intervention</p>
        <span class="text-xs bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">${topIntv.type}</span>
      </div>
      <p class="text-sm font-bold text-slate-900 mb-1">${topIntv.title}</p>
      <p class="text-xs text-slate-600 leading-relaxed">${topIntv.rationale}</p>
      <div class="mt-3 grid grid-cols-3 gap-3 text-center text-xs">
        <div class="bg-white rounded-lg p-2">
          <p class="font-bold text-slate-800">${topIntv.implementation_weeks}w</p>
          <p class="text-slate-400">Timeline</p>
        </div>
        <div class="bg-white rounded-lg p-2">
          <p class="font-bold text-emerald-600">−${topIntv.expected_risk_pct}%</p>
          <p class="text-slate-400">Risk reduction</p>
        </div>
        <div class="bg-white rounded-lg p-2">
          <p class="font-bold text-slate-800">${topIntv.owner}</p>
          <p class="text-slate-400">Owner</p>
        </div>
      </div>
    </div>` : ''}

    <!-- Cost of inaction -->
    <div class="bg-slate-900 rounded-xl p-4">
      <p class="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
        <i class="fas fa-exclamation-triangle mr-1.5"></i>Cost of Inaction
      </p>
      <p class="text-xs text-slate-300 leading-relaxed">${report.estimated_cost_of_inaction}</p>
    </div>

  </div>`;
}
