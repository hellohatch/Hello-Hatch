-- Migration 0002: LRI™ v3.1 — Add lsi_norm and decision_velocity columns
-- lsi_norm = LSI / 5 → aligns formula to 0–1 range
-- decision_velocity = total_decisions / days_elapsed

ALTER TABLE risk_scores ADD COLUMN lsi_norm REAL;
ALTER TABLE risk_scores ADD COLUMN decision_velocity REAL;

-- Backfill lsi_norm for existing rows
UPDATE risk_scores SET lsi_norm = ROUND(lsi / 5.0, 4) WHERE lsi IS NOT NULL AND lsi_norm IS NULL;

-- Backfill risk_score and risk_level using v3.1 formula: (CEI × LLI_norm) / LSI_norm
-- and apply corrected thresholds
UPDATE risk_scores
SET
  risk_score = ROUND((cei * lli_norm) / (lsi / 5.0), 4),
  risk_level = CASE
    WHEN ROUND((cei * lli_norm) / (lsi / 5.0), 4) <= 0.030 THEN 'Low structural risk'
    WHEN ROUND((cei * lli_norm) / (lsi / 5.0), 4) <= 0.080 THEN 'Early exposure'
    WHEN ROUND((cei * lli_norm) / (lsi / 5.0), 4) <= 0.150 THEN 'Emerging dependency'
    WHEN ROUND((cei * lli_norm) / (lsi / 5.0), 4) <= 0.300 THEN 'Structural bottleneck'
    ELSE 'Organizational risk'
  END,
  cascade_stage = CASE
    WHEN ROUND((cei * lli_norm) / (lsi / 5.0), 4) <= 0.030 THEN 'Healthy Distribution'
    WHEN ROUND((cei * lli_norm) / (lsi / 5.0), 4) <= 0.080 THEN 'Emerging Exposure'
    WHEN ROUND((cei * lli_norm) / (lsi / 5.0), 4) <= 0.150 THEN 'Structural Dependency'
    WHEN ROUND((cei * lli_norm) / (lsi / 5.0), 4) <= 0.300 THEN 'Decision Bottleneck'
    ELSE 'Organizational Drag'
  END,
  cascade_level = CASE
    WHEN ROUND((cei * lli_norm) / (lsi / 5.0), 4) <= 0.030 THEN 1
    WHEN ROUND((cei * lli_norm) / (lsi / 5.0), 4) <= 0.080 THEN 2
    WHEN ROUND((cei * lli_norm) / (lsi / 5.0), 4) <= 0.150 THEN 3
    WHEN ROUND((cei * lli_norm) / (lsi / 5.0), 4) <= 0.300 THEN 4
    ELSE 5
  END
WHERE lsi IS NOT NULL AND lli_norm IS NOT NULL AND cei IS NOT NULL AND lsi > 0;
