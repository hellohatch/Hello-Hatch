-- Migration 0004: Rename risk_level and cascade_stage values to v3.2 canonical labels
-- RiskLevel  : title-case, 'Organizational risk' → 'Organizational Drag'
-- CascadeStage: aligned with RiskLevel labels

-- ── risk_scores table ────────────────────────────────────────────────────────
UPDATE risk_scores SET risk_level = 'Low Structural Risk'   WHERE risk_level = 'Low structural risk';
UPDATE risk_scores SET risk_level = 'Early Exposure'        WHERE risk_level = 'Early exposure';
UPDATE risk_scores SET risk_level = 'Emerging Dependency'   WHERE risk_level = 'Emerging dependency';
UPDATE risk_scores SET risk_level = 'Structural Bottleneck' WHERE risk_level = 'Structural bottleneck';
UPDATE risk_scores SET risk_level = 'Organizational Drag'   WHERE risk_level = 'Organizational risk';

UPDATE risk_scores SET cascade_stage = 'Early Exposure'        WHERE cascade_stage = 'Emerging Exposure';
UPDATE risk_scores SET cascade_stage = 'Emerging Dependency'   WHERE cascade_stage = 'Structural Dependency';
UPDATE risk_scores SET cascade_stage = 'Structural Bottleneck' WHERE cascade_stage = 'Decision Bottleneck';

-- Re-classify any rows that may have used old numeric thresholds (0.031 / 0.081 / 0.151 / 0.301)
-- to the new open-interval boundaries (0.030 / 0.080 / 0.150 / 0.300).
-- In practice the values are continuous floats so boundary collisions are rare, but this
-- ensures correctness for any legacy exact-match edge cases.
UPDATE risk_scores
SET
  risk_level = CASE
    WHEN risk_score < 0.030 THEN 'Low Structural Risk'
    WHEN risk_score < 0.080 THEN 'Early Exposure'
    WHEN risk_score < 0.150 THEN 'Emerging Dependency'
    WHEN risk_score < 0.300 THEN 'Structural Bottleneck'
    ELSE 'Organizational Drag'
  END,
  cascade_stage = CASE
    WHEN risk_score < 0.030 THEN 'Healthy Distribution'
    WHEN risk_score < 0.080 THEN 'Early Exposure'
    WHEN risk_score < 0.150 THEN 'Emerging Dependency'
    WHEN risk_score < 0.300 THEN 'Structural Bottleneck'
    ELSE 'Organizational Drag'
  END,
  cascade_level = CASE
    WHEN risk_score < 0.030 THEN 1
    WHEN risk_score < 0.080 THEN 2
    WHEN risk_score < 0.150 THEN 3
    WHEN risk_score < 0.300 THEN 4
    ELSE 5
  END
WHERE lsi IS NOT NULL AND lli_norm IS NOT NULL AND cei IS NOT NULL;
