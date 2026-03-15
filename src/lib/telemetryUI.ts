// ═══════════════════════════════════════════════════════════════════════
// Structural Telemetry Layer™ — UI Renderer
// Generates HTML panels for: Leader Dashboard, Org Portfolio, Executive Brief
// ═══════════════════════════════════════════════════════════════════════

import type { CalibratedRiskResult, DivergenceResult } from '../lib/fusion.js';
import { OPERATIONAL_MODE_META, computeRiskDelta } from '../lib/fusion.js';
import type { TelemetryResult, TelemetryDomainSummary } from '../lib/telemetry.js';
import {
  getTelemetryLevelMeta, TLI_LEVELS, TCI_LEVELS, RPI_LEVELS,
  buildDomainSummaries,
} from '../lib/telemetry.js';
import type { OperationalMode } from '../lib/telemetry.js';

// ───────────────────────────────────────────────
// OPERATIONAL MODE BADGE
// Compact badge showing current intelligence mode
// ───────────────────────────────────────────────
export function renderModeBadge(mode: OperationalMode): string {
  const meta = OPERATIONAL_MODE_META[mode];
  return `
  <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold" style="background:${meta.bg};border-color:${meta.border};color:${meta.color}">
    <i class="fas fa-${meta.icon} text-xs"></i>
    <span>${meta.label}</span>
  </div>`;
}

// ───────────────────────────────────────────────
// TELEMETRY INDEXES PANEL
// Three index gauges: TLI / TCI / RPI
// ───────────────────────────────────────────────
export function renderTelemetryIndexes(fusion: CalibratedRiskResult): string {
  const tel = fusion.telemetry;
  if (!tel.tli && !tel.tci && !tel.rpi) return renderNoTelemetryState();

  const tliMeta = getTelemetryLevelMeta(tel.tli, TLI_LEVELS);
  const tciMeta = getTelemetryLevelMeta(tel.tci, TCI_LEVELS);
  const rpiMeta = getTelemetryLevelMeta(tel.rpi, RPI_LEVELS);

  function indexCard(label: string, abbr: string, value: number, meta: typeof TLI_LEVELS[0], tooltip: string) {
    const pct = Math.round(value * 100);
    return `
    <div class="bg-white rounded-xl border p-4 flex flex-col gap-2" style="border-color:${meta.color}33">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs text-slate-400 font-medium">${label}</p>
          <p class="text-xs font-bold mt-0.5" style="color:${meta.color}">${meta.label}</p>
        </div>
        <div class="text-right">
          <p class="text-2xl font-black" style="color:${meta.color}">${value.toFixed(3)}</p>
          <p class="text-xs text-slate-400">${abbr}</p>
        </div>
      </div>
      <!-- gauge bar -->
      <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all" style="width:${pct}%;background:${meta.color}"></div>
      </div>
      <p class="text-xs text-slate-500 leading-snug">${tooltip}</p>
    </div>`;
  }

  return `
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        <i class="fas fa-satellite-dish mr-1.5"></i>Structural Telemetry Indexes™
      </p>
      <div class="flex items-center gap-2">
        ${renderModeBadge(fusion.mode)}
        <span class="text-xs text-slate-400">Confidence: <span class="font-bold" style="color:${fusion.confidence.color}">${fusion.confidence.label}</span></span>
      </div>
    </div>
    <div class="grid grid-cols-3 gap-3">
      ${indexCard('Telemetry Load Index™',          'TLI', tel.tli, tliMeta, tliMeta.description)}
      ${indexCard('Telemetry Concentration Index™', 'TCI', tel.tci, tciMeta, tciMeta.description)}
      ${indexCard('Recovery Pressure Index™',       'RPI', tel.rpi, rpiMeta, rpiMeta.description)}
    </div>
  </div>`;
}

// ───────────────────────────────────────────────
// DIVERGENCE PANEL
// Shows the divergence pattern + evidence
// ───────────────────────────────────────────────
export function renderDivergencePanel(fusion: CalibratedRiskResult): string {
  const div = fusion.divergence;
  if (!div.pattern && fusion.mode === 'Assessment') return '';

  const noDiv = !div.pattern;
  const bg        = noDiv ? '#F8FAFC' : `${div.color}0D`;
  const border    = noDiv ? '#E2E8F0' : `${div.color}55`;
  const titleColor= noDiv ? '#94A3B8' : div.color;

  const delta      = computeRiskDelta(fusion.assessment.risk_score, fusion.calibrated.risk_score);
  const showDelta  = Math.abs(delta.delta) >= 0.005;

  return `
  <div class="rounded-xl border p-4" style="background:${bg};border-color:${border}">
    <div class="flex items-start gap-3">
      <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background:${div.color}22">
        <i class="fas fa-${div.icon} text-sm" style="color:${div.color}"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap mb-1">
          <p class="text-sm font-bold" style="color:${titleColor}">${div.label}</p>
          ${div.severity !== 'None' ? `<span class="text-xs font-bold px-2 py-0.5 rounded-full text-white" style="background:${div.color}">${div.severity}</span>` : ''}
          ${div.pattern ? `<span class="text-xs text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">${div.pattern}</span>` : ''}
        </div>
        <p class="text-xs text-slate-700 leading-relaxed">${div.description}</p>
        <p class="text-xs text-slate-500 mt-1.5 italic leading-relaxed">${div.implication}</p>

        <!-- Signal divergence metrics -->
        <div class="mt-3 grid grid-cols-3 gap-2">
          <div class="bg-white border border-slate-100 rounded-lg p-2.5 text-center">
            <p class="text-xs text-slate-400 mb-0.5">LLI divergence</p>
            <p class="text-sm font-bold ${div.lli_divergence > 0.1 ? 'text-red-500' : div.lli_divergence < -0.1 ? 'text-emerald-500' : 'text-slate-600'}">
              ${div.lli_divergence >= 0 ? '+' : ''}${div.lli_divergence.toFixed(3)}
            </p>
            <p class="text-xs text-slate-400">TLI − LLI</p>
          </div>
          <div class="bg-white border border-slate-100 rounded-lg p-2.5 text-center">
            <p class="text-xs text-slate-400 mb-0.5">CEI divergence</p>
            <p class="text-sm font-bold ${div.cei_divergence > 0.1 ? 'text-red-500' : div.cei_divergence < -0.1 ? 'text-emerald-500' : 'text-slate-600'}">
              ${div.cei_divergence >= 0 ? '+' : ''}${div.cei_divergence.toFixed(3)}
            </p>
            <p class="text-xs text-slate-400">TCI − CEI</p>
          </div>
          <div class="bg-white border border-slate-100 rounded-lg p-2.5 text-center">
            <p class="text-xs text-slate-400 mb-0.5">Risk delta</p>
            <p class="text-sm font-bold" style="color:${delta.color}">
              ${showDelta ? (delta.delta >= 0 ? '+' : '') + delta.delta.toFixed(4) : 'Aligned'}
            </p>
            <p class="text-xs text-slate-400">Calib. − Assess.</p>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// ───────────────────────────────────────────────
// CALIBRATED RISK SCORE PANEL
// Side-by-side: Assessment vs. Calibrated risk
// ───────────────────────────────────────────────
export function renderCalibratedRiskPanel(fusion: CalibratedRiskResult): string {
  if (fusion.mode === 'Assessment') return '';

  const delta     = computeRiskDelta(fusion.assessment.risk_score, fusion.calibrated.risk_score);
  const riskColors: Record<string, string> = {
    'Low Structural Risk':  '#10B981',
    'Early Exposure':       '#84CC16',
    'Emerging Dependency':  '#F59E0B',
    'Structural Bottleneck':'#F97316',
    'Organizational Drag':  '#EF4444',
  };
  const assColor  = riskColors[fusion.assessment.risk_level] ?? '#94A3B8';
  const calColor  = riskColors[fusion.calibrated.risk_level] ?? '#94A3B8';

  return `
  <div class="bg-white border border-slate-200 rounded-xl p-4">
    <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
      <i class="fas fa-balance-scale mr-1.5"></i>Risk Score Calibration
    </p>
    <div class="grid grid-cols-2 gap-3">
      <!-- Assessment -->
      <div class="bg-slate-50 rounded-xl p-3 text-center">
        <p class="text-xs text-slate-500 mb-1">Assessment Score</p>
        <p class="text-2xl font-black" style="color:${assColor}">${fusion.assessment.risk_score.toFixed(4)}</p>
        <p class="text-xs font-medium mt-0.5" style="color:${assColor}">${fusion.assessment.risk_level}</p>
        <p class="text-xs text-slate-400 mt-0.5">${fusion.assessment.cascade_stage}</p>
        <div class="mt-2 grid grid-cols-2 gap-1 text-xs">
          <div class="bg-white rounded px-1.5 py-1">
            <p class="text-slate-400">LLI</p><p class="font-bold text-slate-700">${fusion.assessment.lli_norm.toFixed(3)}</p>
          </div>
          <div class="bg-white rounded px-1.5 py-1">
            <p class="text-slate-400">CEI</p><p class="font-bold text-slate-700">${fusion.assessment.cei.toFixed(3)}</p>
          </div>
        </div>
      </div>
      <!-- Calibrated -->
      <div class="rounded-xl p-3 text-center border-2" style="border-color:${calColor}44;background:${calColor}08">
        <p class="text-xs mb-1" style="color:${calColor}">Calibrated Score</p>
        <p class="text-2xl font-black" style="color:${calColor}">${fusion.calibrated.risk_score.toFixed(4)}</p>
        <p class="text-xs font-medium mt-0.5" style="color:${calColor}">${fusion.calibrated.risk_level}</p>
        <p class="text-xs mt-0.5" style="color:${calColor}88">${fusion.calibrated.cascade_stage}</p>
        <div class="mt-2 grid grid-cols-2 gap-1 text-xs">
          <div class="bg-white border border-slate-100 rounded px-1.5 py-1">
            <p class="text-slate-400">LLI</p><p class="font-bold" style="color:${calColor}">${fusion.calibrated.lli_norm.toFixed(3)}</p>
          </div>
          <div class="bg-white border border-slate-100 rounded px-1.5 py-1">
            <p class="text-slate-400">CEI</p><p class="font-bold" style="color:${calColor}">${fusion.calibrated.cei.toFixed(3)}</p>
          </div>
        </div>
      </div>
    </div>
    <!-- Delta row -->
    <div class="mt-3 flex items-center justify-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
      <i class="fas fa-${delta.icon} text-xs" style="color:${delta.color}"></i>
      <p class="text-xs font-medium" style="color:${delta.color}">${delta.label}</p>
      <span class="text-xs text-slate-400">·</span>
      <p class="text-xs text-slate-500">RPI: <span class="font-bold text-slate-700">${fusion.calibrated.rpi.toFixed(3)}</span></p>
    </div>
    <!-- Fusion insight -->
    <div class="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2.5">
      <p class="text-xs text-indigo-700 leading-relaxed">${fusion.fusion_insight}</p>
    </div>
  </div>`;
}

// ───────────────────────────────────────────────
// CONFIDENCE METER
// Visual confidence breakdown
// ───────────────────────────────────────────────
export function renderConfidenceMeter(fusion: CalibratedRiskResult): string {
  if (fusion.mode === 'Assessment') return '';
  const conf = fusion.confidence;

  function confBar(label: string, value: number) {
    const pct = Math.round(value * 100);
    const color = value >= 0.7 ? '#10B981' : value >= 0.4 ? '#F59E0B' : '#EF4444';
    return `
    <div>
      <div class="flex items-center justify-between mb-0.5">
        <p class="text-xs text-slate-500">${label}</p>
        <p class="text-xs font-bold" style="color:${color}">${pct}%</p>
      </div>
      <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div class="h-full rounded-full" style="width:${pct}%;background:${color}"></div>
      </div>
    </div>`;
  }

  return `
  <div class="bg-white border border-slate-200 rounded-xl p-4">
    <div class="flex items-center justify-between mb-3">
      <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        <i class="fas fa-shield-alt mr-1.5"></i>Fusion Confidence
      </p>
      <div class="flex items-center gap-1.5">
        <div class="w-2 h-2 rounded-full" style="background:${conf.color}"></div>
        <p class="text-sm font-bold" style="color:${conf.color}">${Math.round(conf.overall * 100)}%</p>
        <p class="text-xs text-slate-400">${conf.label}</p>
      </div>
    </div>
    <div class="space-y-2">
      ${confBar('Telemetry completeness', conf.components.telemetry_completeness)}
      ${confBar('Signal agreement',       conf.components.signal_agreement)}
      ${confBar('Period coverage',        conf.components.period_coverage)}
    </div>
  </div>`;
}

// ───────────────────────────────────────────────
// FULL LEADER TELEMETRY PANEL
// Assembles all telemetry sub-panels for leader dashboard
// ───────────────────────────────────────────────
export function renderLeaderTelemetryPanel(
  fusion: CalibratedRiskResult,
  telResult: TelemetryResult | null
): string {
  const modeMeta = OPERATIONAL_MODE_META[fusion.mode];

  if (fusion.mode === 'Assessment') {
    return renderNoTelemetryState();
  }

  const domainSummaries = telResult
    ? buildDomainSummaries(
        telResult.raw,
        telResult.signals,
        fusion.telemetry.tli,
        fusion.telemetry.tci,
        fusion.telemetry.rpi
      )
    : [];

  return `
<!-- ═══ STRUCTURAL TELEMETRY LAYER™ ═══ -->
<div class="space-y-4">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background:${modeMeta.color}22">
        <i class="fas fa-satellite-dish text-sm" style="color:${modeMeta.color}"></i>
      </div>
      <div>
        <p class="text-sm font-bold text-slate-900">Structural Telemetry Layer™</p>
        <p class="text-xs text-slate-400 mt-0.5">${modeMeta.description}</p>
      </div>
    </div>
    ${renderModeBadge(fusion.mode)}
  </div>

  <!-- TLI / TCI / RPI indexes -->
  ${renderTelemetryIndexes(fusion)}

  <!-- Calibrated risk vs assessment -->
  ${renderCalibratedRiskPanel(fusion)}

  <!-- Divergence panel -->
  ${renderDivergencePanel(fusion)}

  <!-- Confidence meter -->
  ${renderConfidenceMeter(fusion)}

  <!-- Domain signal breakdown -->
  ${domainSummaries.length ? renderDomainBreakdown(domainSummaries) : ''}
</div>`;
}

// ───────────────────────────────────────────────
// DOMAIN BREAKDOWN TABLE
// Per-domain signal rows with sparkbars
// ───────────────────────────────────────────────
function renderDomainBreakdown(summaries: TelemetryDomainSummary[]): string {
  return `
  <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">
    <div class="px-4 py-3 border-b border-slate-100">
      <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        <i class="fas fa-table mr-1.5"></i>Signal Domain Detail
      </p>
    </div>
    <div class="divide-y divide-slate-100">
      ${summaries.map(d => `
      <div>
        <div class="px-4 py-2 flex items-center gap-2" style="background:${d.color}08">
          <i class="fas fa-${d.icon} text-xs w-4" style="color:${d.color}"></i>
          <p class="text-xs font-bold" style="color:${d.color}">${d.domain}</p>
          <span class="text-xs ml-auto font-bold" style="color:${d.color}">${d.index_value.toFixed(3)} · ${d.index_label}</span>
        </div>
        <div class="px-4 pb-2 space-y-1.5 pt-1.5">
          ${d.signals.map(s => {
            const pct = Math.round(s.value * 100);
            const barColor = s.value > 0.7 ? '#EF4444' : s.value > 0.4 ? '#F59E0B' : '#10B981';
            return `
            <div class="flex items-center gap-2">
              <p class="text-xs text-slate-500 w-40 flex-shrink-0">${s.label}</p>
              <div class="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full rounded-full" style="width:${pct}%;background:${barColor}"></div>
              </div>
              <p class="text-xs text-slate-600 w-16 text-right font-medium">${s.raw_value} <span class="text-slate-400 font-normal">${s.unit}</span></p>
            </div>`;
          }).join('')}
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}

// ───────────────────────────────────────────────
// ORG TELEMETRY SUMMARY PANEL
// For org portfolio view — aggregated telemetry health
// ───────────────────────────────────────────────
export function renderOrgTelemetrySummary(
  leaders: Array<{
    leader_id: number;
    name: string;
    role_level: string;
    tli: number | null;
    tci: number | null;
    rpi: number | null;
    operational_mode: string | null;
    calibrated_risk_score: number | null;
    assessment_risk_score: number | null;
    divergence_pattern: string | null;
    divergence_severity: string | null;
    confidence_overall: number | null;
  }>,
  avgTLI: number | null,
  avgTCI: number | null,
  avgRPI: number | null
): string {
  const withTelemetry = leaders.filter(l => l.tli !== null);
  if (!withTelemetry.length) {
    return `
    <div class="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-6 text-center">
      <i class="fas fa-satellite-dish text-slate-300 text-3xl mb-3 block"></i>
      <p class="text-sm font-bold text-slate-500">No Telemetry Connected</p>
      <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Connect enterprise calendar, ticketing, or HR data sources to enable structural telemetry calibration.</p>
    </div>`;
  }

  const tliMeta = avgTLI !== null ? getTelemetryLevelMeta(avgTLI, TLI_LEVELS) : null;
  const tciMeta = avgTCI !== null ? getTelemetryLevelMeta(avgTCI, TCI_LEVELS) : null;
  const rpiMeta = avgRPI !== null ? getTelemetryLevelMeta(avgRPI, RPI_LEVELS) : null;

  const divergenceColors: Record<string, string> = {
    'Confirmed Overload':      '#EF4444',
    'Hidden Dependency':       '#F97316',
    'Perception Strain':       '#F59E0B',
    'Structural Misalignment': '#8B5CF6',
    'Confirmed Stability':     '#10B981',
    'None':                    '#94A3B8',
  };

  return `
  <div class="space-y-4">
    <!-- Portfolio telemetry indexes -->
    <div class="grid grid-cols-3 gap-3">
      ${tliMeta ? `
      <div class="bg-white border rounded-xl p-3 text-center" style="border-color:${tliMeta.color}33">
        <p class="text-xs text-slate-400 mb-1">Portfolio Avg TLI</p>
        <p class="text-xl font-black" style="color:${tliMeta.color}">${avgTLI!.toFixed(3)}</p>
        <p class="text-xs font-medium" style="color:${tliMeta.color}">${tliMeta.label}</p>
      </div>` : '<div class="bg-slate-50 rounded-xl p-3 text-center"><p class="text-xs text-slate-400">TLI N/A</p></div>'}
      ${tciMeta ? `
      <div class="bg-white border rounded-xl p-3 text-center" style="border-color:${tciMeta.color}33">
        <p class="text-xs text-slate-400 mb-1">Portfolio Avg TCI</p>
        <p class="text-xl font-black" style="color:${tciMeta.color}">${avgTCI!.toFixed(3)}</p>
        <p class="text-xs font-medium" style="color:${tciMeta.color}">${tciMeta.label}</p>
      </div>` : '<div class="bg-slate-50 rounded-xl p-3 text-center"><p class="text-xs text-slate-400">TCI N/A</p></div>'}
      ${rpiMeta ? `
      <div class="bg-white border rounded-xl p-3 text-center" style="border-color:${rpiMeta.color}33">
        <p class="text-xs text-slate-400 mb-1">Portfolio Avg RPI</p>
        <p class="text-xl font-black" style="color:${rpiMeta.color}">${avgRPI!.toFixed(3)}</p>
        <p class="text-xs font-medium" style="color:${rpiMeta.color}">${rpiMeta.label}</p>
      </div>` : '<div class="bg-slate-50 rounded-xl p-3 text-center"><p class="text-xs text-slate-400">RPI N/A</p></div>'}
    </div>

    <!-- Leader-level telemetry rows -->
    <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <i class="fas fa-users mr-1.5"></i>Leader Telemetry Status
        </p>
        <span class="text-xs text-slate-400">${withTelemetry.length} of ${leaders.length} connected</span>
      </div>
      <div class="divide-y divide-slate-100">
        ${leaders.map(l => {
          const hasTel   = l.tli !== null;
          const mode     = l.operational_mode ?? 'Assessment';
          const modeMeta = OPERATIONAL_MODE_META[mode as OperationalMode] ?? OPERATIONAL_MODE_META['Assessment'];
          const dp       = l.divergence_pattern ?? 'None';
          const dpColor  = divergenceColors[dp] ?? '#94A3B8';
          const riskDelta= hasTel && l.calibrated_risk_score !== null && l.assessment_risk_score !== null
            ? l.calibrated_risk_score - l.assessment_risk_score
            : null;

          return `
          <div class="px-4 py-3 flex items-center gap-3">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style="background:${modeMeta.color}">
              ${l.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <a href="/org/leader/${l.leader_id}" class="text-sm font-bold text-slate-900 hover:text-indigo-600">${l.name}</a>
                <span class="text-xs text-slate-400">${l.role_level}</span>
              </div>
              ${hasTel ? `
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-xs text-slate-500">TLI <b>${l.tli!.toFixed(2)}</b></span>
                <span class="text-slate-300">·</span>
                <span class="text-xs text-slate-500">TCI <b>${l.tci!.toFixed(2)}</b></span>
                <span class="text-slate-300">·</span>
                <span class="text-xs text-slate-500">RPI <b>${l.rpi!.toFixed(2)}</b></span>
              </div>` : '<p class="text-xs text-slate-400 mt-0.5">No telemetry data</p>'}
            </div>
            <div class="flex items-center gap-3 flex-shrink-0 text-center">
              ${hasTel && dp !== 'None' ? `
              <div>
                <p class="text-xs font-bold" style="color:${dpColor}">${dp === 'Confirmed Stability' ? 'Stable' : dp.split(' ').slice(0,2).join(' ')}</p>
                <p class="text-xs text-slate-400">Divergence</p>
              </div>` : ''}
              ${riskDelta !== null ? `
              <div>
                <p class="text-xs font-bold ${riskDelta > 0.005 ? 'text-red-500' : riskDelta < -0.005 ? 'text-emerald-500' : 'text-slate-500'}">
                  ${riskDelta >= 0 ? '+' : ''}${riskDelta.toFixed(3)}
                </p>
                <p class="text-xs text-slate-400">Risk Δ</p>
              </div>` : ''}
              <div class="text-xs font-bold px-2 py-0.5 rounded-full" style="background:${modeMeta.bg};color:${modeMeta.color}">
                ${mode.replace(' Mode', '')}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>`;
}

// ───────────────────────────────────────────────
// BRIEF TELEMETRY SECTION
// Compact panel for executive brief
// ───────────────────────────────────────────────
export function renderBriefTelemetrySection(fusion: CalibratedRiskResult): string {
  if (fusion.mode === 'Assessment') {
    return `
    <div class="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 text-center">
      <p class="text-xs font-bold text-slate-500">Structural Telemetry Layer™ — Not Connected</p>
      <p class="text-xs text-slate-400 mt-1">Assessment Mode only. Connect telemetry to enable calibrated risk scoring.</p>
    </div>`;
  }

  const delta    = computeRiskDelta(fusion.assessment.risk_score, fusion.calibrated.risk_score);
  const div      = fusion.divergence;
  const tel      = fusion.telemetry;
  const modeMeta = OPERATIONAL_MODE_META[fusion.mode];
  const tliMeta  = getTelemetryLevelMeta(tel.tli, TLI_LEVELS);
  const tciMeta  = getTelemetryLevelMeta(tel.tci, TCI_LEVELS);
  const rpiMeta  = getTelemetryLevelMeta(tel.rpi, RPI_LEVELS);

  return `
  <div class="space-y-4">
    <!-- Mode + confidence header -->
    <div class="flex items-center justify-between">
      ${renderModeBadge(fusion.mode)}
      <span class="text-xs text-slate-500">Confidence: <span class="font-bold" style="color:${fusion.confidence.color}">${fusion.confidence.label} (${Math.round(fusion.confidence.overall * 100)}%)</span></span>
    </div>

    <!-- Three-index row -->
    <div class="grid grid-cols-3 gap-3 text-center">
      <div class="bg-white border rounded-xl p-3" style="border-color:${tliMeta.color}44">
        <p class="text-xs text-slate-400">TLI</p>
        <p class="text-lg font-black" style="color:${tliMeta.color}">${tel.tli.toFixed(3)}</p>
        <p class="text-xs font-medium" style="color:${tliMeta.color}">${tliMeta.label}</p>
      </div>
      <div class="bg-white border rounded-xl p-3" style="border-color:${tciMeta.color}44">
        <p class="text-xs text-slate-400">TCI</p>
        <p class="text-lg font-black" style="color:${tciMeta.color}">${tel.tci.toFixed(3)}</p>
        <p class="text-xs font-medium" style="color:${tciMeta.color}">${tciMeta.label}</p>
      </div>
      <div class="bg-white border rounded-xl p-3" style="border-color:${rpiMeta.color}44">
        <p class="text-xs text-slate-400">RPI</p>
        <p class="text-lg font-black" style="color:${rpiMeta.color}">${tel.rpi.toFixed(3)}</p>
        <p class="text-xs font-medium" style="color:${rpiMeta.color}">${rpiMeta.label}</p>
      </div>
    </div>

    <!-- Assessment vs calibrated -->
    <div class="grid grid-cols-2 gap-3 text-center text-sm">
      <div class="bg-slate-50 rounded-xl p-3">
        <p class="text-xs text-slate-400 mb-0.5">Assessment Risk</p>
        <p class="text-xl font-black text-slate-700">${fusion.assessment.risk_score.toFixed(4)}</p>
        <p class="text-xs text-slate-500">${fusion.assessment.risk_level}</p>
      </div>
      <div class="rounded-xl p-3 border-2" style="border-color:${delta.color}44">
        <p class="text-xs mb-0.5" style="color:${delta.color}">Calibrated Risk</p>
        <p class="text-xl font-black" style="color:${delta.color}">${fusion.calibrated.risk_score.toFixed(4)}</p>
        <p class="text-xs font-medium" style="color:${delta.color}">${fusion.calibrated.risk_level}</p>
      </div>
    </div>

    <!-- Divergence -->
    ${div.pattern ? `
    <div class="border-l-4 rounded-r-xl px-4 py-3" style="border-color:${div.color};background:${div.color}0D">
      <div class="flex items-center gap-2 mb-1">
        <i class="fas fa-${div.icon} text-xs" style="color:${div.color}"></i>
        <span class="text-xs font-bold uppercase tracking-wide" style="color:${div.color}">${div.pattern}</span>
        <span class="text-xs font-bold px-1.5 py-0.5 rounded text-white ml-auto" style="background:${div.color}">${div.severity}</span>
      </div>
      <p class="text-xs text-slate-700">${div.description}</p>
    </div>` : ''}

    <!-- Fusion insight -->
    <div class="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
      <p class="text-xs font-semibold text-indigo-700 mb-1">Intelligence Fusion Insight</p>
      <p class="text-xs text-slate-700 leading-relaxed">${fusion.fusion_insight}</p>
    </div>
  </div>`;
}

// ───────────────────────────────────────────────
// HELPER: No Telemetry State
// ───────────────────────────────────────────────
function renderNoTelemetryState(): string {
  return `
  <div class="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-6">
    <div class="flex flex-col items-center text-center gap-3">
      <div class="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
        <i class="fas fa-satellite-dish text-slate-400 text-xl"></i>
      </div>
      <div>
        <p class="text-sm font-bold text-slate-600">Structural Telemetry Layer™</p>
        <p class="text-xs text-slate-400 mt-1 max-w-sm">
          Telemetry not connected for this leader. Platform operating in
          <strong>Assessment Mode</strong> — risk intelligence derived from
          LRI™ perception signals only.
        </p>
      </div>
      <div class="bg-white border border-slate-200 rounded-xl px-4 py-3 w-full text-left space-y-1.5 text-xs text-slate-500">
        <p class="font-semibold text-slate-600 mb-1">Telemetry enhances:</p>
        <div class="flex items-center gap-2"><i class="fas fa-check text-indigo-400 w-3"></i><span>Calibrated LLI and CEI via operational data</span></div>
        <div class="flex items-center gap-2"><i class="fas fa-check text-indigo-400 w-3"></i><span>Hidden dependency and blind-spot detection</span></div>
        <div class="flex items-center gap-2"><i class="fas fa-check text-indigo-400 w-3"></i><span>Recovery pressure and after-hours density signals</span></div>
        <div class="flex items-center gap-2"><i class="fas fa-check text-indigo-400 w-3"></i><span>Divergence detection (perceived vs. observed)</span></div>
        <div class="flex items-center gap-2"><i class="fas fa-check text-indigo-400 w-3"></i><span>Confidence-scored fusion output</span></div>
      </div>
    </div>
  </div>`;
}
