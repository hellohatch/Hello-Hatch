// ═══════════════════════════════════════════════════════════════════════
// Intelligence Fusion Engine™  v1.0
// Leadership Risk Intelligence™ Platform — Hatch
//
// PURPOSE:
//   Integrates perception-based signals (from LRI™ assessment) with
//   telemetry-derived structural indicators to produce calibrated
//   leadership risk intelligence.
//
// FUSION LOGIC:
//   1. CALIBRATION  — adjust LLI_norm and CEI using telemetry signals
//   2. DIVERGENCE   — detect gaps between perceived and observed load/concentration
//   3. CONFIDENCE   — score reliability of the fused output
//   4. FINAL RISK   — re-compute Risk Score™ using calibrated inputs
//
// THREE OPERATIONAL MODES:
//   Assessment Mode       → assessment data only (no telemetry)
//   Calibrated Mode       → telemetry supplements assessment
//   Full Intelligence Mode → full fusion with divergence detection
//
// FOUR DIVERGENCE SCENARIOS:
//   Confirmed Overload        — high perceived + high telemetry load
//   Hidden Dependency         — low perceived CEI + high telemetry TCI
//   Perception Strain         — high perceived load + low telemetry load
//   Structural Misalignment   — high telemetry + low perceived (blind spot)
// ═══════════════════════════════════════════════════════════════════════

import type { RiskScoreResult, RiskLevel, CascadeStage } from '../types/index.js';
import type { TelemetryResult, TelemetryIndexes, OperationalMode } from './telemetry.js';
import { classifyOperationalMode, getTelemetryLevelMeta, TLI_LEVELS, TCI_LEVELS, RPI_LEVELS } from './telemetry.js';
import { CASCADE_STAGES, getRiskLevelMeta } from './scoring.js';

// ───────────────────────────────────────────────
// DIVERGENCE TYPES
// ───────────────────────────────────────────────

export type DivergencePattern =
  | 'Confirmed Overload'
  | 'Hidden Dependency'
  | 'Perception Strain'
  | 'Structural Misalignment'
  | 'Confirmed Stability'
  | null;

export interface DivergenceResult {
  pattern: DivergencePattern;
  label: string;
  description: string;
  implication: string;
  color: string;
  icon: string;
  severity: 'Critical' | 'High' | 'Moderate' | 'Low' | 'None';
  // Numeric divergence: positive = telemetry higher than perception
  lli_divergence: number;    // TLI - LLI_norm  (range -1 to +1)
  cei_divergence: number;    // TCI - CEI        (range -1 to +1)
  divergence_magnitude: number;  // Overall distance 0–1
}

// ───────────────────────────────────────────────
// CALIBRATED RISK RESULT
// ───────────────────────────────────────────────

export interface CalibratedRiskResult {
  // Operational mode
  mode: OperationalMode;
  telemetry_confidence: number;

  // Original assessment-only scores
  assessment: {
    lli_norm: number;
    cei: number;
    lsi_norm: number;
    risk_score: number;
    risk_level: RiskLevel;
    cascade_stage: CascadeStage;
  };

  // Calibrated/fused values
  calibrated: {
    lli_norm: number;           // TLI-calibrated
    cei: number;                // TCI-calibrated
    lsi_norm: number;           // unchanged (perception-only construct)
    risk_score: number;         // (calibrated_CEI × calibrated_LLI) / lsi_norm
    risk_level: RiskLevel;
    cascade_stage: CascadeStage;
    cascade_level: number;
    rpi: number;                // Recovery Pressure from telemetry
  };

  // Divergence analysis
  divergence: DivergenceResult;

  // Confidence scoring
  confidence: {
    overall: number;            // 0–1
    label: string;
    color: string;
    components: {
      telemetry_completeness: number;
      signal_agreement: number;
      period_coverage: number;
    };
  };

  // Telemetry indexes for display
  telemetry: TelemetryIndexes;

  // Narrative for the fusion output
  fusion_insight: string;
}

// ───────────────────────────────────────────────
// CALIBRATION LOGIC
// Blends perception signals with telemetry signals
// Weight of telemetry increases with confidence
// ───────────────────────────────────────────────

function calibrateLLI(
  perception_lli: number,
  tli: number,
  confidence: number
): number {
  // Telemetry weight scales with confidence (max 50% weight at full confidence)
  const telWeight = confidence * 0.50;
  const percWeight = 1 - telWeight;
  const calibrated = perception_lli * percWeight + tli * telWeight;
  return parseFloat(Math.min(1, Math.max(0, calibrated)).toFixed(4));
}

function calibrateCEI(
  perception_cei: number,
  tci: number,
  confidence: number
): number {
  const telWeight = confidence * 0.50;
  const percWeight = 1 - telWeight;
  const calibrated = perception_cei * percWeight + tci * telWeight;
  return parseFloat(Math.min(1, Math.max(0, calibrated)).toFixed(4));
}

// ───────────────────────────────────────────────
// DIVERGENCE DETECTION
// Classifies the relationship between perceived and observed signals
// ───────────────────────────────────────────────

function detectDivergence(
  perception_lli: number,
  perception_cei: number,
  tli: number,
  tci: number
): DivergenceResult {
  const lli_div = parseFloat((tli - perception_lli).toFixed(4));
  const cei_div = parseFloat((tci - perception_cei).toFixed(4));
  const magnitude = parseFloat(Math.sqrt(lli_div ** 2 + cei_div ** 2).toFixed(4));

  // Thresholds for "high" vs "low"
  const HIGH_THRESHOLD  = 0.35;
  const AGREE_THRESHOLD = 0.15;

  const percHigh_load  = perception_lli >= HIGH_THRESHOLD;
  const percHigh_conc  = perception_cei >= HIGH_THRESHOLD;
  const telHigh_load   = tli >= HIGH_THRESHOLD;
  const telHigh_conc   = tci >= HIGH_THRESHOLD;
  const agrees_load    = Math.abs(lli_div) < AGREE_THRESHOLD;
  const agrees_conc    = Math.abs(cei_div) < AGREE_THRESHOLD;

  // ── Pattern classification ──

  // Confirmed Overload: both high load AND high concentration in both perception + telemetry
  if (percHigh_load && telHigh_load && percHigh_conc && telHigh_conc) {
    return {
      pattern: 'Confirmed Overload',
      label: 'Confirmed structural overload',
      description: 'High perceived AND high observed load and concentration — structural overload confirmed across both signal sources.',
      implication: 'This leader is operating at or beyond structural capacity. Dual-signal confirmation indicates high certainty. Immediate intervention required.',
      color: '#EF4444',
      icon: 'exclamation-circle',
      severity: 'Critical',
      lli_divergence: lli_div,
      cei_divergence: cei_div,
      divergence_magnitude: magnitude,
    };
  }

  // Hidden Dependency: low perceived CEI but telemetry shows high concentration
  if (!percHigh_conc && telHigh_conc && cei_div > 0.25) {
    return {
      pattern: 'Hidden Dependency',
      label: 'Hidden structural dependency detected',
      description: 'Perception-based concentration appears manageable, but telemetry reveals significant routing and approval dependency concentration.',
      implication: 'This leader may not recognize the extent of structural dependency they represent. Blind spot risk: the dependency is real but not yet self-perceived. Early intervention prevents surprise escalation.',
      color: '#F97316',
      icon: 'eye-slash',
      severity: 'High',
      lli_divergence: lli_div,
      cei_divergence: cei_div,
      divergence_magnitude: magnitude,
    };
  }

  // Perception Strain: high perceived load but telemetry is moderate
  if (percHigh_load && !telHigh_load && lli_div < -0.20) {
    return {
      pattern: 'Perception Strain',
      label: 'Perception strain above structural load',
      description: 'Perceived leadership load significantly exceeds observed operational demand — role ambiguity or psychological burden may be amplifying experienced strain.',
      implication: 'Structural load is manageable, but the leader\'s perception of burden is significantly elevated. Investigate role clarity, authority boundaries, and psychological safety. May indicate role confusion rather than structural overload.',
      color: '#F59E0B',
      icon: 'brain',
      severity: 'Moderate',
      lli_divergence: lli_div,
      cei_divergence: cei_div,
      divergence_magnitude: magnitude,
    };
  }

  // Structural Misalignment: telemetry high but perception low (blind spot)
  if ((telHigh_load || telHigh_conc) && !percHigh_load && !percHigh_conc && magnitude > 0.30) {
    return {
      pattern: 'Structural Misalignment',
      label: 'Structural risk not yet perceived',
      description: 'Telemetry signals indicate elevated structural demand and concentration, but perception-based assessment shows low load and concentration.',
      implication: 'Early warning: structural risk is accumulating in ways the leader has not yet registered. Common in leaders who minimize or normalize overload. Preventative intervention before perception catches up.',
      color: '#8B5CF6',
      icon: 'exclamation-triangle',
      severity: 'Moderate',
      lli_divergence: lli_div,
      cei_divergence: cei_div,
      divergence_magnitude: magnitude,
    };
  }

  // Confirmed Stability: both sources show low risk
  if (agrees_load && agrees_conc && !percHigh_load && !percHigh_conc) {
    return {
      pattern: 'Confirmed Stability',
      label: 'Structural stability confirmed',
      description: 'Perception and telemetry signals are in agreement — both indicate manageable load and distributed decision routing.',
      implication: 'Dual-source confirmation of structural health. Low risk of hidden dependency or blind-spot accumulation. Quarterly monitoring appropriate.',
      color: '#10B981',
      icon: 'check-double',
      severity: 'None',
      lli_divergence: lli_div,
      cei_divergence: cei_div,
      divergence_magnitude: magnitude,
    };
  }

  // Default: mild divergence, no clear pattern
  return {
    pattern: null,
    label: 'Moderate signal divergence',
    description: 'Some difference between perceived and observed signals, but below threshold for pattern classification.',
    implication: 'Monitor for convergence or escalation. Suggest retaking assessment if divergence persists over multiple periods.',
    color: '#94A3B8',
    icon: 'equals',
    severity: 'Low',
    lli_divergence: lli_div,
    cei_divergence: cei_div,
    divergence_magnitude: magnitude,
  };
}

// ───────────────────────────────────────────────
// CONFIDENCE SCORING
// Multi-component confidence in the fused output
// ───────────────────────────────────────────────

function computeFusionConfidence(
  telData: TelemetryResult,
  divergence: DivergenceResult
): CalibratedRiskResult['confidence'] {
  const idx = telData.indexes;

  // Component 1: Telemetry completeness (signal quality)
  const telemetry_completeness = idx.signal_completeness;

  // Component 2: Signal agreement (lower divergence → higher agreement)
  const signal_agreement = parseFloat(
    Math.max(0, 1 - divergence.divergence_magnitude * 1.5).toFixed(4)
  );

  // Component 3: Period coverage
  const period_coverage = parseFloat(
    Math.min(1, telData.raw.period_weeks / 8).toFixed(4)
  );

  // Overall confidence: weighted blend
  const overall = parseFloat((
    telemetry_completeness * 0.50 +
    signal_agreement       * 0.30 +
    period_coverage        * 0.20
  ).toFixed(4));

  const label = overall >= 0.80 ? 'Very High'
    : overall >= 0.60 ? 'High'
    : overall >= 0.40 ? 'Moderate'
    : 'Low';

  const color = overall >= 0.80 ? '#6366F1'
    : overall >= 0.60 ? '#10B981'
    : overall >= 0.40 ? '#F59E0B'
    : '#EF4444';

  return {
    overall,
    label,
    color,
    components: { telemetry_completeness, signal_agreement, period_coverage },
  };
}

// ───────────────────────────────────────────────
// RISK RE-CLASSIFICATION
// Uses calibrated LLI + CEI to recompute Risk Score™
// ───────────────────────────────────────────────

function classifyRiskFromScore(score: number): { risk_level: RiskLevel; cascade_stage: CascadeStage; cascade_level: number } {
  if (score < 0.030) return { risk_level: 'Low Structural Risk',  cascade_stage: 'Healthy Distribution',  cascade_level: 1 };
  if (score < 0.080) return { risk_level: 'Early Exposure',       cascade_stage: 'Early Exposure',         cascade_level: 2 };
  if (score < 0.150) return { risk_level: 'Emerging Dependency',  cascade_stage: 'Emerging Dependency',    cascade_level: 3 };
  if (score < 0.300) return { risk_level: 'Structural Bottleneck',cascade_stage: 'Structural Bottleneck',  cascade_level: 4 };
  return              { risk_level: 'Organizational Drag',         cascade_stage: 'Organizational Drag',    cascade_level: 5 };
}

// ───────────────────────────────────────────────
// FUSION INSIGHT NARRATIVE
// Single sentence for executive communication
// ───────────────────────────────────────────────

function buildFusionInsight(
  mode: OperationalMode,
  divergence: DivergenceResult,
  calibrated: CalibratedRiskResult['calibrated'],
  assessment: CalibratedRiskResult['assessment'],
  confidence: CalibratedRiskResult['confidence']
): string {
  if (mode === 'Assessment') {
    return 'Operating in Assessment Mode — telemetry integration not yet active. Risk score derived from perception-based signals only.';
  }

  const riskDelta = parseFloat((calibrated.risk_score - assessment.risk_score).toFixed(4));
  const direction = riskDelta > 0.01 ? 'elevated' : riskDelta < -0.01 ? 'reduced' : 'consistent with';
  const deltaAbs  = Math.abs(riskDelta).toFixed(4);

  if (divergence.pattern === 'Confirmed Overload') {
    return `Dual-signal confirmation: both perception and telemetry indicate structural overload. Calibrated risk score ${direction} assessment baseline by ${deltaAbs}. Immediate structural intervention indicated.`;
  }
  if (divergence.pattern === 'Hidden Dependency') {
    return `Telemetry reveals hidden structural dependency not captured by perception assessment. Calibrated risk score is ${direction} the assessment baseline by ${deltaAbs}. Leader may be underestimating structural exposure.`;
  }
  if (divergence.pattern === 'Perception Strain') {
    return `Perceived load significantly exceeds structural telemetry signals. Calibrated risk score is ${direction} the assessment baseline. Role clarity and authority boundary review recommended.`;
  }
  if (divergence.pattern === 'Structural Misalignment') {
    return `Telemetry signals indicate structural risk accumulation not yet reflected in assessment. Calibrated risk is ${direction} the baseline by ${deltaAbs}. Early preventative action warranted.`;
  }
  if (divergence.pattern === 'Confirmed Stability') {
    return `Dual-signal confirmation of structural health. Telemetry and assessment signals aligned. Calibrated risk score ${direction} assessment baseline. Quarterly monitoring appropriate.`;
  }

  return `${mode === 'Full Intelligence' ? 'Full telemetry fusion' : 'Partial telemetry calibration'} active. Calibrated risk score is ${direction} assessment baseline (Δ ${deltaAbs}). Confidence: ${confidence.label}.`;
}

// ═══════════════════════════════════════════════════════════════
// MASTER FUNCTION: computeFusion()
// Single entry point for the Intelligence Fusion Engine™
// ═══════════════════════════════════════════════════════════════

export function computeFusion(
  assessmentScores: RiskScoreResult,
  telemetryData: TelemetryResult | null
): CalibratedRiskResult {

  const assessment = {
    lli_norm:      assessmentScores.lli_norm,
    cei:           assessmentScores.cei,
    lsi_norm:      assessmentScores.lsi_norm,
    risk_score:    assessmentScores.risk_score,
    risk_level:    assessmentScores.risk_level,
    cascade_stage: assessmentScores.cascade_stage,
  };

  // No telemetry → Assessment Mode passthrough
  if (!telemetryData) {
    const mode: OperationalMode = 'Assessment';
    return {
      mode,
      telemetry_confidence: 0,
      assessment,
      calibrated: {
        lli_norm:      assessment.lli_norm,
        cei:           assessment.cei,
        lsi_norm:      assessment.lsi_norm,
        risk_score:    assessment.risk_score,
        risk_level:    assessment.risk_level,
        cascade_stage: assessment.cascade_stage,
        cascade_level: assessmentScores.cascade_level,
        rpi:           0,
      },
      divergence: {
        pattern: null,
        label: 'No telemetry data',
        description: 'Telemetry not available. Risk intelligence based on assessment signals only.',
        implication: 'Connect telemetry to enable divergence detection and calibrated risk scoring.',
        color: '#94A3B8',
        icon: 'plug',
        severity: 'None',
        lli_divergence: 0,
        cei_divergence: 0,
        divergence_magnitude: 0,
      },
      confidence: {
        overall: 0,
        label: 'Assessment Only',
        color: '#94A3B8',
        components: { telemetry_completeness: 0, signal_agreement: 0, period_coverage: 0 },
      },
      telemetry: { tli: 0, tci: 0, rpi: 0, telemetry_composite: 0, data_confidence: 0, signal_completeness: 0 },
      fusion_insight: 'Operating in Assessment Mode — telemetry integration not yet active.',
    };
  }

  const idx = telemetryData.indexes;
  const mode = classifyOperationalMode(true, true, idx.data_confidence);

  // ── Divergence detection (before calibration for clean comparison)
  const divergence = detectDivergence(
    assessment.lli_norm,
    assessment.cei,
    idx.tli,
    idx.tci
  );

  // ── Confidence
  const confidence = computeFusionConfidence(telemetryData, divergence);

  // ── Calibration
  const calibrated_lli  = calibrateLLI(assessment.lli_norm, idx.tli, idx.data_confidence);
  const calibrated_cei  = calibrateCEI(assessment.cei,      idx.tci, idx.data_confidence);
  const lsi_norm        = assessment.lsi_norm; // LSI stays perception-only

  // ── Re-compute risk score with calibrated inputs
  const calibrated_risk = lsi_norm > 0
    ? parseFloat(((calibrated_cei * calibrated_lli) / lsi_norm).toFixed(4))
    : 0;

  const { risk_level, cascade_stage, cascade_level } = classifyRiskFromScore(calibrated_risk);

  const calibrated: CalibratedRiskResult['calibrated'] = {
    lli_norm:      calibrated_lli,
    cei:           calibrated_cei,
    lsi_norm,
    risk_score:    calibrated_risk,
    risk_level,
    cascade_stage,
    cascade_level,
    rpi:           idx.rpi,
  };

  const fusion_insight = buildFusionInsight(mode, divergence, calibrated, assessment, confidence);

  return {
    mode,
    telemetry_confidence: idx.data_confidence,
    assessment,
    calibrated,
    divergence,
    confidence,
    telemetry: idx,
    fusion_insight,
  };
}

// ───────────────────────────────────────────────
// OPERATIONAL MODE METADATA (for UI)
// ───────────────────────────────────────────────

export const OPERATIONAL_MODE_META: Record<OperationalMode, {
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  description: string;
}> = {
  'Assessment': {
    label: 'Assessment Mode',
    icon: 'clipboard-list',
    color: '#6366F1',
    bg: '#EEF2FF',
    border: '#A5B4FC',
    description: 'Risk intelligence derived from LRI™ assessment instrument only. Telemetry not connected.',
  },
  'Calibrated': {
    label: 'Calibrated Mode',
    icon: 'sliders-h',
    color: '#F59E0B',
    bg: '#FFFBEB',
    border: '#FCD34D',
    description: 'Telemetry supplements assessment signals with partial calibration. Some signal divergence detection active.',
  },
  'Full Intelligence': {
    label: 'Full Intelligence Mode',
    icon: 'brain',
    color: '#10B981',
    bg: '#ECFDF5',
    border: '#6EE7B7',
    description: 'Full telemetry fusion active. Divergence detection, calibrated risk scoring, and confidence modeling all operational.',
  },
};

// ───────────────────────────────────────────────
// RISK DELTA DISPLAY HELPER
// ───────────────────────────────────────────────

export interface RiskDeltaDisplay {
  delta: number;
  direction: 'up' | 'down' | 'flat';
  color: string;
  icon: string;
  label: string;
}

export function computeRiskDelta(
  assessmentRisk: number,
  calibratedRisk: number
): RiskDeltaDisplay {
  const delta = parseFloat((calibratedRisk - assessmentRisk).toFixed(4));
  const abs   = Math.abs(delta);

  if (abs < 0.005) {
    return { delta, direction: 'flat', color: '#94A3B8', icon: 'minus', label: 'No material change' };
  }
  if (delta > 0) {
    return { delta, direction: 'up', color: '#EF4444', icon: 'arrow-up', label: `+${delta.toFixed(4)} above assessment` };
  }
  return { delta, direction: 'down', color: '#10B981', icon: 'arrow-down', label: `${delta.toFixed(4)} below assessment` };
}
