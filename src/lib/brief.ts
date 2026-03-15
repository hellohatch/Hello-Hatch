// Leadership Risk Intelligence™ — Executive Intelligence Brief Generator
// Generates full HTML brief matching SoW Section 20 report sections

import type { RiskScoreResult, SignalDomain } from '../types/index.js';
import { DOMAIN_META, DOMAIN_KEYS } from './questions.js';
import {
  CASCADE_STAGES, RISK_LEVELS, SIGNAL_PATTERN_META,
  getRiskLevelMeta,
} from './scoring.js';
import type { InterventionReport } from './interventions.js';
import { renderBriefInterventionSection } from './interventionUI.js';
import type { CalibratedRiskResult } from './fusion.js';
import { renderBriefTelemetrySection } from './telemetryUI.js';

const DOMAIN_LABEL: Record<SignalDomain, string> = {
  stress_regulation: 'Stress Regulation',
  cognitive_breadth: 'Cognitive Breadth',
  trust_climate: 'Trust Climate',
  ethical_integrity: 'Ethical Integrity',
  leadership_durability: 'Leadership Durability',
  adaptive_capacity: 'Adaptive Capacity',
};

function scoreBar(value: number, max: number = 5, color: string): string {
  const pct = Math.round((value / max) * 100);
  return `<div class="score-bar-container">
    <div class="score-bar-fill" style="width:${pct}%;background:${color}"></div>
  </div>`;
}

function starRating(value: number, max: number = 5): string {
  const stars = Math.round(value);
  return Array.from({ length: max }, (_, i) =>
    `<span class="${i < stars ? 'star-filled' : 'star-empty'}">★</span>`
  ).join('');
}

export function generateBriefHTML(
  leaderName: string,
  orgName: string,
  roleLevel: string,
  scores: RiskScoreResult,
  futureOrientation: string,
  assessmentDate: string,
  previousRiskScores: number[] = [],
  interventionReport?: InterventionReport | null,
  fusionResult?: CalibratedRiskResult | null
): string {
  const riskMeta  = getRiskLevelMeta(scores.risk_score);
  const stageMeta = CASCADE_STAGES.find(s => s.stage === scores.cascade_stage)!;
  const patternMeta = SIGNAL_PATTERN_META[scores.signal_pattern];

  // Find strongest and weakest domains
  const domainEntries = DOMAIN_KEYS.map(k => ({ key: k, score: scores[k] as number, label: DOMAIN_LABEL[k] }));
  const sorted = [...domainEntries].sort((a, b) => b.score - a.score);
  const strongest = sorted[0];
  const watchArea = sorted[sorted.length - 1];

  // 30-day plan based on pattern + risk level
  const thirtyDayPlan = generate30DayPlan(scores);

  // Trajectory scenarios
  const scenarios = generateScenarios(scores);

  const date = new Date(assessmentDate).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Leadership Risk Intelligence™ Brief — ${leaderName}</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  body { font-family: 'Inter', sans-serif; background: #F8FAFC; color: #0F172A; }
  .score-bar-container { height: 6px; background: #E2E8F0; border-radius: 99px; overflow: hidden; width: 100%; }
  .score-bar-fill { height: 100%; border-radius: 99px; transition: width 1s ease; }
  .star-filled { color: #F59E0B; }
  .star-empty  { color: #E2E8F0; }
  .cascade-step { transition: all 0.2s; }
  .section-divider { border-top: 1px solid #E2E8F0; margin: 2rem 0; }
  @media print {
    .no-print { display: none !important; }
    body { background: white; }
    .print-break { page-break-before: always; }
  }
</style>
</head>
<body>

<!-- TOP NAV -->
<nav class="bg-slate-900 text-white px-6 py-3 flex items-center justify-between no-print sticky top-0 z-20">
  <div class="flex items-center gap-3">
    <div class="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
      <i class="fas fa-chart-line text-xs"></i>
    </div>
    <span class="font-bold text-sm tracking-tight">Leadership Risk Intelligence™</span>
    <span class="text-slate-500 text-xs ml-2">Executive Brief</span>
  </div>
  <div class="flex gap-3">
    <a href="/dashboard" class="text-slate-400 hover:text-white text-xs transition-colors">
      <i class="fas fa-arrow-left mr-1"></i>Dashboard
    </a>
    <button onclick="window.print()" class="text-slate-400 hover:text-white text-xs transition-colors">
      <i class="fas fa-print mr-1"></i>Print / PDF
    </button>
  </div>
</nav>

<div class="max-w-4xl mx-auto px-4 py-8 space-y-6">

  <!-- ═══════════════════════════════════════════
       HEADER — IDENTITY + COMPOSITE RISK SCORE
  ═══════════════════════════════════════════ -->
  <div class="bg-slate-900 rounded-2xl p-8 text-white">
    <div class="flex items-start justify-between flex-wrap gap-4">
      <div>
        <p class="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-2">Leadership Risk Intelligence™ Brief</p>
        <h1 class="text-3xl font-bold mb-1">${leaderName}</h1>
        <p class="text-slate-300 text-sm">${roleLevel} · ${orgName}</p>
        <p class="text-slate-500 text-xs mt-1">Assessment completed ${date}</p>
      </div>
      <div class="text-center bg-white/5 border border-white/10 rounded-2xl px-8 py-5">
        <p class="text-slate-400 text-xs mb-2 uppercase tracking-wider">Leadership Risk Score™</p>
        <p class="text-5xl font-black" style="color:${riskMeta.color}">${scores.risk_score.toFixed(3)}</p>
        <p class="text-sm font-semibold mt-2" style="color:${riskMeta.color}">${scores.risk_level}</p>
        <div class="mt-3 flex items-center justify-center gap-2">
          <div class="w-2 h-2 rounded-full" style="background:${stageMeta.color}"></div>
          <span class="text-xs text-slate-400">${scores.cascade_stage}</span>
        </div>
      </div>
    </div>

    <!-- The investor visual: Signal → Load → Concentration → Risk -->
    <div class="mt-8 grid grid-cols-4 gap-2">
      ${[
        { label: 'Leadership Signals', value: scores.lsi.toFixed(2), sub: `LSI_norm = ${scores.lsi_norm.toFixed(2)}`, color: '#6366F1' },
        { label: 'Leadership Load', value: scores.lli_norm.toFixed(2), sub: `LLI_norm / 1.0`, color: '#F59E0B' },
        { label: 'Decision Concentration', value: (scores.cei * 100).toFixed(0) + '%', sub: `CEI = ${scores.cei.toFixed(3)}`, color: '#F97316' },
        { label: 'Structural Risk', value: scores.risk_score.toFixed(3), sub: scores.risk_level, color: riskMeta.color },
      ].map((item, i) => `
      <div class="bg-white/5 border border-white/10 rounded-xl p-4 relative">
        ${i < 3 ? `<div class="absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-600 text-lg">↓</div>` : ''}
        <p class="text-xs text-slate-400 mb-2">${item.label}</p>
        <p class="text-2xl font-bold" style="color:${item.color}">${item.value}</p>
        <p class="text-xs text-slate-500 mt-0.5">${item.sub}</p>
      </div>`).join('')}
    </div>
    <!-- v3.1 formula clarification -->
    <div class="mt-4 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-400 font-mono text-center">
      Risk Score = (CEI × LLI_norm) / LSI_norm &nbsp;|&nbsp; LSI_norm = LSI / 5 &nbsp;|&nbsp; All variables aligned to 0–1 range
    </div>
  </div>

  <!-- ═══════════════════════════════════════════
       SIGNAL PATTERN + STRONGEST / WATCH AREA
  ═══════════════════════════════════════════ -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Signal Pattern</p>
      <div class="flex items-center gap-2 mb-3">
        <div class="w-8 h-8 rounded-xl flex items-center justify-center" style="background:${patternMeta.color}22">
          <i class="fas fa-${patternMeta.icon} text-sm" style="color:${patternMeta.color}"></i>
        </div>
        <span class="text-sm font-bold text-slate-900">${scores.signal_pattern}</span>
      </div>
      <p class="text-xs text-slate-600 leading-relaxed">${patternMeta.description}</p>
    </div>
    <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Strongest Signal</p>
      <p class="text-base font-bold text-slate-900 mb-1">${strongest.label}</p>
      <div class="flex items-center gap-2 mb-2">
        <span class="text-2xl font-black text-emerald-600">${strongest.score.toFixed(1)}</span>
        <span class="text-slate-400 text-sm">/ 5.0</span>
      </div>
      ${scoreBar(strongest.score, 5, '#10B981')}
      <p class="text-xs text-slate-500 mt-2">Top-performing domain. Acts as a structural buffer.</p>
    </div>
    <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Watch Area</p>
      <p class="text-base font-bold text-slate-900 mb-1">${watchArea.label}</p>
      <div class="flex items-center gap-2 mb-2">
        <span class="text-2xl font-black text-orange-500">${watchArea.score.toFixed(1)}</span>
        <span class="text-slate-400 text-sm">/ 5.0</span>
      </div>
      ${scoreBar(watchArea.score, 5, '#F97316')}
      <p class="text-xs text-slate-500 mt-2">Lowest domain signal. Priority development target.</p>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════
       LEADERSHIP SIGNAL RADAR + SCORECARD
  ═══════════════════════════════════════════ -->
  <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
    <div class="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <p class="text-sm font-bold text-slate-800 mb-4">Leadership Signal Radar</p>
      <canvas id="signalRadar" height="280"></canvas>
    </div>
    <div class="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <p class="text-sm font-bold text-slate-800 mb-4">Leadership Signal Scorecard</p>
      <div class="space-y-4">
        ${DOMAIN_KEYS.map(key => {
          const score = scores[key] as number;
          const meta = DOMAIN_META.find(d => d.key === key)!;
          const pct = ((score - 1) / 4) * 100;
          return `
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full" style="background:${meta.color}"></div>
                <span class="text-sm font-medium text-slate-700">${meta.label}</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-xs text-slate-400">${starRating(score)}</span>
                <span class="text-sm font-bold text-slate-900 w-8 text-right">${score.toFixed(1)}</span>
              </div>
            </div>
            ${scoreBar(pct, 100, meta.color)}
          </div>`;
        }).join('')}
        <div class="pt-3 border-t border-slate-100 space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold text-slate-700">Leadership Signal Index™</span>
            <span class="text-xl font-black text-slate-900">${scores.lsi.toFixed(2)} <span class="text-sm text-slate-400 font-normal">/ 5.0</span></span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-400">LSI_norm = LSI / 5</span>
            <span class="font-bold text-indigo-600">${scores.lsi_norm.toFixed(3)}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════
       LEADERSHIP COST CASCADE™ STAIRCASE
  ═══════════════════════════════════════════ -->
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
    <p class="text-sm font-bold text-slate-800 mb-1">Leadership Cost Cascade™</p>
    <p class="text-xs text-slate-500 mb-5">Classified by Risk Score (v3.1): <strong>${scores.risk_score.toFixed(3)}</strong> — CEI = ${scores.cei.toFixed(2)} · LLI_norm = ${scores.lli_norm.toFixed(2)} · LSI_norm = ${scores.lsi_norm.toFixed(3)}</p>
    <div class="flex items-end gap-2 overflow-x-auto pb-2">
      ${CASCADE_STAGES.map((s, i) => {
        const isActive = s.stage === scores.cascade_stage;
        const isPassed = s.level < scores.cascade_level;
        const height = 40 + (i * 20);
        return `
        <div class="flex-1 min-w-[100px] cascade-step flex flex-col items-center">
          <div class="w-full rounded-xl flex items-end justify-center text-center px-2 py-2 transition-all"
            style="height:${height}px;background:${isActive ? s.color : isPassed ? s.color + '66' : '#F1F5F9'};
            border: 2px solid ${isActive ? s.color : 'transparent'};">
            ${isActive ? `<i class="fas fa-map-marker-alt text-white text-sm"></i>` : ''}
          </div>
          <p class="text-xs font-semibold mt-2 text-center leading-tight" style="color:${isActive ? s.color : '#94A3B8'}">${s.stage}</p>
          <p class="text-xs text-slate-400 text-center">Risk ${s.riskRange[0].toFixed(2)}–${s.riskRange[1] > 900 ? '∞' : s.riskRange[1].toFixed(2)}</p>
        </div>`;
      }).join('')}
    </div>
    <div class="mt-4 p-4 rounded-xl border" style="background:${stageMeta.bg};border-color:${stageMeta.color}44">
      <p class="text-xs font-semibold" style="color:${stageMeta.color}">Stage ${scores.cascade_level}: ${scores.cascade_stage}</p>
      <p class="text-sm text-slate-700 mt-1">${stageMeta.description}</p>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════
       SIGNAL DOMAIN ANALYSIS
  ═══════════════════════════════════════════ -->
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
    <p class="text-sm font-bold text-slate-800 mb-4">Signal Domain Analysis</p>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${DOMAIN_KEYS.map(key => {
        const score = scores[key] as number;
        const meta = DOMAIN_META.find(d => d.key === key)!;
        const interpretation = getDomainInterpretation(key, score);
        return `
        <div class="border border-slate-100 rounded-xl p-4">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full" style="background:${meta.color}"></div>
              <span class="text-sm font-semibold text-slate-800">${meta.label}</span>
            </div>
            <span class="text-lg font-black" style="color:${meta.color}">${score.toFixed(2)}</span>
          </div>
          <p class="text-xs text-slate-500 mb-2">${meta.description}</p>
          <p class="text-xs text-slate-700 leading-relaxed italic">"${interpretation}"</p>
        </div>`;
      }).join('')}
    </div>
  </div>

  <!-- ═══════════════════════════════════════════
       LEADERSHIP SIGNAL TRAJECTORY™
  ═══════════════════════════════════════════ -->
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
    <div class="flex items-start justify-between mb-4">
      <div>
        <p class="text-sm font-bold text-slate-800">Leadership Signal Trajectory™</p>
        <p class="text-xs text-slate-500 mt-0.5">Scenario modeling based on current signal and load dynamics</p>
      </div>
      <div class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
        style="background:${scores.trajectory_direction === 'Improving' ? '#ECFDF5' : scores.trajectory_direction === 'Declining' ? '#FEF2F2' : '#F1F5F9'};
               color:${scores.trajectory_direction === 'Improving' ? '#065F46' : scores.trajectory_direction === 'Declining' ? '#7F1D1D' : '#475569'}">
        <i class="fas fa-arrow-${scores.trajectory_direction === 'Improving' ? 'trend-up' : scores.trajectory_direction === 'Declining' ? 'trend-down' : 'right'}"></i>
        ${scores.trajectory_direction}
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      ${scenarios.map(s => `
      <div class="rounded-xl p-4 border" style="background:${s.bg};border-color:${s.borderColor}">
        <p class="text-xs font-semibold uppercase tracking-wide mb-1" style="color:${s.titleColor}">${s.title}</p>
        <p class="text-xs text-slate-700 leading-relaxed">${s.description}</p>
      </div>`).join('')}
    </div>
  </div>

  <!-- ═══════════════════════════════════════════
       CONCENTRATION EXPOSURE INTERPRETATION
  ═══════════════════════════════════════════ -->
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
    <p class="text-sm font-bold text-slate-800 mb-4">Concentration Exposure Interpretation</p>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <div class="flex items-center gap-4 mb-4">
          <div class="text-center">
            <p class="text-4xl font-black" style="color:${stageMeta.color}">${(scores.cei * 100).toFixed(0)}%</p>
            <p class="text-xs text-slate-500">of decisions</p>
          </div>
          <div class="flex-1">
            <p class="text-sm font-semibold text-slate-800 mb-1">Concentration Exposure Index™</p>
            <p class="text-xs text-slate-600">CEI = ${scores.cei.toFixed(3)}</p>
            <div class="mt-2 h-3 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full rounded-full" style="width:${scores.cei * 100}%;background:${stageMeta.color}"></div>
            </div>
            <div class="flex justify-between text-xs text-slate-400 mt-1">
              <span>0.00</span><span>0.50</span><span>1.00</span>
            </div>
          </div>
        </div>
        <p class="text-xs text-slate-600 leading-relaxed">${stageMeta.description}</p>
      </div>
      <div>
        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Exposure Thresholds</p>
        <div class="space-y-1.5">
          ${CASCADE_STAGES.map(s => `
          <div class="flex items-center gap-2 p-2 rounded-lg ${s.stage === scores.cascade_stage ? 'border' : ''}"
            style="${s.stage === scores.cascade_stage ? `background:${s.bg};border-color:${s.color}44` : ''}">
            <div class="w-2 h-2 rounded-full flex-shrink-0" style="background:${s.color}"></div>
            <span class="text-xs text-slate-500 w-24 flex-shrink-0">${s.riskRange[0].toFixed(2)}–${s.riskRange[1] > 900 ? '∞' : s.riskRange[1].toFixed(2)}</span>
            <span class="text-xs font-medium" style="color:${s.stage === scores.cascade_stage ? s.color : '#64748B'}">${s.stage}</span>
          </div>`).join('')}
        </div>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════
       30-DAY STRUCTURAL STRENGTHENING PLAN
  ═══════════════════════════════════════════ -->
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
    <p class="text-sm font-bold text-slate-800 mb-1">30-Day Structural Strengthening Plan</p>
    <p class="text-xs text-slate-500 mb-5">Prioritized actions based on signal pattern: <strong>${scores.signal_pattern}</strong></p>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      ${thirtyDayPlan.map((week, i) => `
      <div class="border border-slate-100 rounded-xl p-4">
        <p class="text-xs font-bold text-blue-600 mb-3">WEEK ${i + 1}${i === 2 ? '–4' : ''}</p>
        <ul class="space-y-2">
          ${week.map(action => `
          <li class="flex items-start gap-2 text-xs text-slate-700">
            <i class="fas fa-check-circle text-blue-400 mt-0.5 flex-shrink-0"></i>
            ${action}
          </li>`).join('')}
        </ul>
      </div>`).join('')}
    </div>
  </div>

  <!-- ═══════════════════════════════════════════
       STRUCTURAL INTERVENTION ENGINE™
  ═══════════════════════════════════════════ -->
  ${interventionReport ? `
  <div>
    <div class="flex items-center gap-3 mb-4">
      <div class="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
        <i class="fas fa-cogs text-white text-sm"></i>
      </div>
      <div>
        <h2 class="text-base font-bold text-slate-900">Structural Intervention Engine™</h2>
        <p class="text-xs text-slate-400">AI-powered structural failure detection and prescription</p>
      </div>
    </div>
    ${renderBriefInterventionSection(interventionReport)}
  </div>` : ''}

  <!-- ═══════════════════════════════════════════
       STRUCTURAL TELEMETRY LAYER™
  ═══════════════════════════════════════════ -->
  <div>
    <div class="flex items-center gap-3 mb-4">
      <div class="w-8 h-8 bg-violet-600 rounded-xl flex items-center justify-center">
        <i class="fas fa-satellite-dish text-white text-sm"></i>
      </div>
      <div>
        <h2 class="text-base font-bold text-slate-900">Structural Telemetry Layer™</h2>
        <p class="text-xs text-slate-400">Operational metadata calibration · ${fusionResult ? fusionResult.mode : 'Assessment Mode'}</p>
      </div>
    </div>
    ${fusionResult ? renderBriefTelemetrySection(fusionResult) : renderBriefTelemetrySection({ mode: 'Assessment', telemetry_confidence: 0, assessment: { lli_norm: scores.lli_norm, cei: scores.cei, lsi_norm: scores.lsi_norm, risk_score: scores.risk_score, risk_level: scores.risk_level, cascade_stage: scores.cascade_stage }, calibrated: { lli_norm: scores.lli_norm, cei: scores.cei, lsi_norm: scores.lsi_norm, risk_score: scores.risk_score, risk_level: scores.risk_level, cascade_stage: scores.cascade_stage, cascade_level: scores.cascade_level, rpi: 0 }, divergence: { pattern: null, label: '', description: '', implication: '', color: '#94A3B8', icon: 'plug', severity: 'None', lli_divergence: 0, cei_divergence: 0, divergence_magnitude: 0 }, confidence: { overall: 0, label: 'Assessment Only', color: '#94A3B8', components: { telemetry_completeness: 0, signal_agreement: 0, period_coverage: 0 } }, telemetry: { tli: 0, tci: 0, rpi: 0, telemetry_composite: 0, data_confidence: 0, signal_completeness: 0 }, fusion_insight: '' })}
  </div>

  <!-- ═══════════════════════════════════════════
       ORGANIZATIONAL IMPLICATIONS
  ═══════════════════════════════════════════ -->
  <div class="bg-slate-50 rounded-2xl border border-slate-200 p-6">
    <p class="text-sm font-bold text-slate-800 mb-4">Organizational Implications</p>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-700">
      <div class="space-y-3">
        ${getOrgImplications(scores).slice(0, 3).map(i => `
        <div class="flex items-start gap-2">
          <i class="fas fa-building text-slate-400 mt-0.5 flex-shrink-0"></i>
          <span class="text-xs">${i}</span>
        </div>`).join('')}
      </div>
      <div class="space-y-3">
        ${getOrgImplications(scores).slice(3).map(i => `
        <div class="flex items-start gap-2">
          <i class="fas fa-building text-slate-400 mt-0.5 flex-shrink-0"></i>
          <span class="text-xs">${i}</span>
        </div>`).join('')}
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════
       FINAL PERSPECTIVE
  ═══════════════════════════════════════════ -->
  <div class="bg-slate-900 rounded-2xl p-6 text-white">
    <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Final Perspective</p>
    <p class="text-sm text-slate-300 leading-relaxed mb-4">${getFinalPerspective(scores, leaderName)}</p>
    ${futureOrientation ? `
    <div class="border-t border-white/10 pt-4 mt-4">
      <p class="text-xs text-slate-400 mb-2">Leadership Orientation Statement</p>
      <p class="text-sm text-white italic">"${futureOrientation}"</p>
    </div>` : ''}
    <div class="mt-5 flex items-center gap-3">
      <div class="w-px h-8 bg-blue-500"></div>
      <p class="text-xs text-slate-400">Leadership Risk Intelligence™ · Hatch · Confidential</p>
    </div>
  </div>

  <!-- Signal Pattern Implication card -->
  <div class="p-4 rounded-xl border" style="background:${patternMeta.color}11;border-color:${patternMeta.color}33">
    <p class="text-xs font-semibold" style="color:${patternMeta.color}">Advisory Note — ${scores.signal_pattern}</p>
    <p class="text-sm text-slate-700 mt-1">${patternMeta.implication}</p>
  </div>

</div><!-- end max-w-4xl -->

<script>
// Radar Chart
const ctx = document.getElementById('signalRadar').getContext('2d');
new Chart(ctx, {
  type: 'radar',
  data: {
    labels: ['Stress\\nRegulation','Cognitive\\nBreadth','Trust\\nClimate','Ethical\\nIntegrity','Leadership\\nDurability','Adaptive\\nCapacity'],
    datasets: [{
      label: 'Signal Profile',
      data: [${scores.stress_regulation},${scores.cognitive_breadth},${scores.trust_climate},${scores.ethical_integrity},${scores.leadership_durability},${scores.adaptive_capacity}],
      backgroundColor: 'rgba(99,102,241,0.15)',
      borderColor: '#6366F1',
      borderWidth: 2,
      pointBackgroundColor: '#6366F1',
      pointRadius: 4,
    }]
  },
  options: {
    responsive: true,
    scales: {
      r: {
        min: 0, max: 5, ticks: { stepSize: 1, font: { size: 9 } },
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

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function getDomainInterpretation(domain: SignalDomain, score: number): string {
  const level = score >= 4.2 ? 'high' : score >= 3.0 ? 'mid' : 'low';
  const map: Record<SignalDomain, Record<string, string>> = {
    stress_regulation: {
      high: 'Pressure absorption is a demonstrated strength. This leader performs with consistency even in high-demand environments.',
      mid:  'Stress regulation is functional but showing signs of compression. Monitor for behavioral drift under sustained pressure.',
      low:  'Stress response patterns are compromising consistent performance. Structural load relief is recommended.',
    },
    cognitive_breadth: {
      high: 'Strategic thinking integrates multiple domains effectively. This leader is capable of operating at significant complexity.',
      mid:  'Cognitive integration is adequate. Some risk of domain tunnel vision under high load conditions.',
      low:  'Strategic bandwidth is constrained. Decision quality may be narrowing as cognitive load increases.',
    },
    trust_climate: {
      high: 'The leader has established strong psychological safety. Organizational intelligence is likely flowing freely.',
      mid:  'Trust conditions are functional. Some risk of information filtering in high-stakes moments.',
      low:  'Trust climate is deteriorating. Organizational signal fidelity is at risk — leaders may not be receiving accurate data.',
    },
    ethical_integrity: {
      high: 'Strong value-behavior alignment observed. This leader acts consistently with stated principles.',
      mid:  'Integrity signals are present but experiencing pressure-related erosion. Monitor decision quality under conflict.',
      low:  'Value-behavior gaps are emerging. Ethical risk is entering the organizational system through this leader.',
    },
    leadership_durability: {
      high: 'Leadership stamina is strong. Capacity is not under acute threat at current load levels.',
      mid:  'Durability is holding but showing early depletion signals. Recovery capacity should be monitored.',
      low:  'Leadership capacity is at risk of saturation. Sustained demand is eroding the quality and consistency of performance.',
    },
    adaptive_capacity: {
      high: 'Recalibration is fast and effective. This leader models adaptive behavior that enables organizational agility.',
      mid:  'Adaptation is occurring but lagging environmental pace. Some rigidity under high-change conditions.',
      low:  'Adaptive lag is significant. The leader may be holding on to frameworks and structures past their optimal utility.',
    },
  };
  return map[domain][level];
}

function generate30DayPlan(scores: RiskScoreResult): string[][] {
  const weeks: string[][] = [[], [], []];
  const pattern = scores.signal_pattern;

  if (pattern === 'Structural Bottleneck Risk' || pattern === 'Leadership Load Saturation') {
    weeks[0] = [
      'Map all decisions currently routed through you — identify the top 5 for delegation',
      'Audit escalation triggers — define what should not reach you',
      'Block 3 hours/week of protected strategic time',
    ];
    weeks[1] = [
      'Implement a delegation pilot — transfer 2 decision categories to senior reports',
      'Measure decision throughput before and after redistribution',
      'Identify structural mechanisms that are creating routing dependency',
    ];
    weeks[2] = [
      'Review delegation outcomes — recalibrate where needed',
      'Conduct a load assessment with direct reports',
      'Establish a 90-day re-assessment to track CEI trajectory',
    ];
  } else if (pattern === 'Strategic Interpreter') {
    weeks[0] = [
      `Deepen ${DOMAIN_LABEL[DOMAIN_KEYS.reduce((a, b) => (scores[a] as number) < (scores[b] as number) ? a : b)]} — schedule deliberate practice`,
      'Review your decision input sources — are you accessing diverse signal streams?',
      'Identify one emerging strategic domain you are under-indexing on',
    ];
    weeks[1] = [
      'Share your interpretive framework explicitly with 2 direct reports',
      'Create one structured space for strategic dialogue with your leadership team',
      'Review load levels — ensure bandwidth is protected for strategic work',
    ];
    weeks[2] = [
      'Evaluate whether your cognitive contributions are translating into organizational action',
      'Assess whether trust climate is enabling full signal flow to you',
      'Plan 90-day reassessment to track domain development',
    ];
  } else {
    // Organizational Stabilizer — maintain and build
    weeks[0] = [
      'Document and share what is working in your leadership system',
      'Identify emerging leaders who can be developed using your model',
      'Review your CEI — even stable leaders should monitor concentration',
    ];
    weeks[1] = [
      'Invest development energy in your watch area domain',
      'Create deliberate conditions for other leaders to build visibility',
      'Review load trajectory — is your LLI increasing across cycles?',
    ];
    weeks[2] = [
      'Schedule 90-day signal reassessment to maintain longitudinal data',
      'Design one structural improvement to reduce CEI further',
      'Benchmark your signal profile against organizational peers',
    ];
  }
  return weeks;
}

function generateScenarios(scores: RiskScoreResult): Array<{
  title: string; description: string; bg: string; borderColor: string; titleColor: string;
}> {
  return [
    {
      title: 'If Load Decreases',
      description: `With LLI_norm reduced to ${Math.max(0, scores.lli_norm - 0.15).toFixed(2)}, Risk Score would approximate ${Math.max(0, (scores.cei * Math.max(0, scores.lli_norm - 0.15)) / scores.lsi).toFixed(3)}. Structural risk would likely shift to ${classifyRiskLevelSimple(scores.cei * Math.max(0, scores.lli_norm - 0.15) / scores.lsi)}.`,
      bg: '#F0FDF4', borderColor: '#BBF7D0', titleColor: '#15803D',
    },
    {
      title: 'If CEI Rises',
      description: `If concentration increases to CEI ${Math.min(1, scores.cei + 0.15).toFixed(2)}, Risk Score would reach ${((Math.min(1, scores.cei + 0.15) * scores.lli_norm) / scores.lsi).toFixed(3)}. Cascade stage would enter ${getCascadeStageSimple(Math.min(1, scores.cei + 0.15))}.`,
      bg: '#FFFBEB', borderColor: '#FDE68A', titleColor: '#92400E',
    },
    {
      title: 'If Signals Improve',
      description: `With LSI improving to ${Math.min(5, scores.lsi + 0.4).toFixed(2)}, Risk Score would reduce to ${((scores.cei * scores.lli_norm) / Math.min(5, scores.lsi + 0.4)).toFixed(3)}. Signal investment directly reduces structural risk.`,
      bg: '#EFF6FF', borderColor: '#BFDBFE', titleColor: '#1D4ED8',
    },
  ];
}

function classifyRiskLevelSimple(rs: number): string {
  if (rs < 0.030) return 'Low Structural Risk';
  if (rs < 0.080) return 'Early Exposure';
  if (rs < 0.150) return 'Emerging Dependency';
  if (rs < 0.300) return 'Structural Bottleneck';
  return 'Organizational Drag';
}

function getCascadeStageSimple(cei: number): string {
  if (cei < 0.30) return 'Healthy Distribution';
  if (cei < 0.45) return 'Early Exposure';
  if (cei < 0.65) return 'Emerging Dependency';
  if (cei < 0.80) return 'Structural Bottleneck';
  return 'Organizational Drag';
}

function getOrgImplications(scores: RiskScoreResult): string[] {
  const implications = [
    'Leadership decisions are currently routing through a concentration point — organizational velocity depends on this leader\'s availability.',
    `Signal variance of ${scores.domain_variance.toFixed(2)} indicates ${scores.domain_variance < 0.5 ? 'consistent, balanced capability across all domains' : 'meaningful capability variation across domains that creates uneven organizational coverage'}.`,
    `Load normalization at ${scores.lli_norm.toFixed(2)} means ${scores.lli_norm > 0.6 ? 'decision demand is operating at high intensity — sustainability should be evaluated' : 'decision demand is within a manageable range for the current context'}.`,
    `At CEI ${scores.cei.toFixed(2)}, the organization is in the ${scores.cascade_stage} stage. ${scores.cascade_level >= 3 ? 'Structural intervention to redistribute decision routing is recommended.' : 'Current distribution is within healthy parameters.'}`,
    `The ${scores.signal_pattern} pattern suggests ${getPatternOrgImplication(scores.signal_pattern)}.`,
    `Leadership Risk Score™ of ${scores.risk_score.toFixed(3)} places this leader in the ${scores.risk_level} category. ${scores.risk_score > 0.15 ? 'Organizational performance risk is elevated.' : 'Current structural risk is manageable with appropriate monitoring.'}`,
  ];
  return implications;
}

function getPatternOrgImplication(pattern: SignalPattern): string {
  const map: Record<SignalPattern, string> = {
    'Organizational Stabilizer':     'the leader is functioning as a stabilizing force — preserving this signal profile should be a priority',
    'Strategic Interpreter':          'the organization benefits from this leader\'s interpretive capacity — ensure bandwidth is protected for this function',
    'Structural Bottleneck Risk':     'decision routing architecture needs redesign — this leader\'s effectiveness is being compromised by structural concentration',
    'Leadership Load Saturation':     'capacity depletion is imminent without structural intervention — load reduction is a priority action',
  };
  return map[pattern];
}

function getFinalPerspective(scores: RiskScoreResult, name: string): string {
  if (scores.risk_level === 'Low Structural Risk') {
    return `${name} is operating with strong signal integrity and healthy structural distribution. The current profile represents a high-functioning leadership system. The priority is maintenance, longitudinal tracking, and ensuring that current conditions do not drift under future load increases.`;
  }
  if (scores.risk_level === 'Early Exposure') {
    return `${name}'s profile shows a leader performing with solid signals but with emerging structural exposure. This is the optimal window for preventative structural investment — before concentration and load dynamics compound into measurable risk.`;
  }
  if (scores.risk_level === 'Emerging Dependency') {
    return `The structural dynamics around ${name}'s leadership are beginning to create organizational dependency. Signal quality remains a buffer, but the convergence of load and concentration requires active intervention. Delay increases the cost and timeline of correction.`;
  }
  if (scores.risk_level === 'Structural Bottleneck') {
    return `${name} is operating at the threshold of structural bottleneck. The organization's decision throughput and velocity are materially compromised. Immediate structural redesign — including delegation architecture and decision routing reform — is recommended.`;
  }
  return `The convergence of signals, load, and concentration in ${name}'s profile represents an acute organizational risk condition. Leadership capacity is under systemic pressure. The priority is urgent structural intervention, not performance optimization. The risk is organizational, not personal.`;
}
