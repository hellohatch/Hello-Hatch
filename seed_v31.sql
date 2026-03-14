-- LRI™ v3.1 Reseed — Calibrated demo data for correct Risk Score distribution
-- Risk = (CEI × LLI_norm) / LSI_norm  where LSI_norm = LSI / 5
-- Target distribution:
--   James Rivera:  Risk 0.220  → Structural bottleneck   (CEI=0.134, LLI=0.95, LSI=2.9)
--   David Park:    Risk 0.120  → Emerging dependency     (CEI=0.109, LLI=0.75, LSI=3.4)
--   Alex Morgan:   Risk 0.100  → Emerging dependency     (CEI=0.106, LLI=0.70, LSI=3.7)
--   Priya Kapoor:  Risk 0.055  → Early exposure          (CEI=0.095, LLI=0.45, LSI=3.867)
--   Sarah Chen:    Risk 0.018  → Low structural risk     (CEI=0.064, LLI=0.25, LSI=4.433)

-- ─── JAMES RIVERA (leader_id=3) — Structural bottleneck
UPDATE risk_scores SET
  lsi            = 2.9,
  lsi_norm       = 0.58,
  lli_raw        = 4.8,
  lli_norm       = 0.95,
  cei            = 0.134,
  cei_leader_decisions = 20,
  cei_total_decisions  = 150,
  risk_score     = 0.2200,
  risk_level     = 'Structural bottleneck',
  cascade_stage  = 'Decision Bottleneck',
  cascade_level  = 4,
  trajectory_direction = 'Declining',
  signal_pattern = 'Leadership Load Saturation'
WHERE leader_id = 3 AND score_id = 3;

-- ─── DAVID PARK (leader_id=5) — Emerging dependency
UPDATE risk_scores SET
  lsi            = 3.4,
  lsi_norm       = 0.68,
  lli_raw        = 4.0,
  lli_norm       = 0.75,
  cei            = 0.109,
  cei_leader_decisions = 18,
  cei_total_decisions  = 165,
  risk_score     = 0.1200,
  risk_level     = 'Emerging dependency',
  cascade_stage  = 'Structural Dependency',
  cascade_level  = 3,
  trajectory_direction = 'Stable',
  signal_pattern = 'Structural Bottleneck Risk'
WHERE leader_id = 5 AND score_id = 5;

-- ─── ALEX MORGAN (leader_id=1) — Emerging dependency (latest score)
UPDATE risk_scores SET
  lsi            = 3.7,
  lsi_norm       = 0.74,
  lli_raw        = 4.5,
  lli_norm       = 0.70,
  cei            = 0.106,
  cei_leader_decisions = 16,
  cei_total_decisions  = 151,
  risk_score     = 0.1000,
  risk_level     = 'Emerging dependency',
  cascade_stage  = 'Structural Dependency',
  cascade_level  = 3,
  trajectory_direction = 'Improving',
  signal_pattern = 'Structural Bottleneck Risk'
WHERE leader_id = 1 AND score_id = 1;

-- Alex Morgan historical (score_id=10) — slightly worse
UPDATE risk_scores SET
  lsi            = 3.5,
  lsi_norm       = 0.70,
  lli_raw        = 4.6,
  lli_norm       = 0.90,
  cei            = 0.117,
  cei_leader_decisions = 18,
  cei_total_decisions  = 154,
  risk_score     = 0.1500,
  risk_level     = 'Structural bottleneck',
  cascade_stage  = 'Decision Bottleneck',
  cascade_level  = 4,
  trajectory_direction = 'Declining',
  signal_pattern = 'Structural Bottleneck Risk'
WHERE leader_id = 1 AND score_id = 10;

-- Alex Morgan historical (score_id=11) — best period
UPDATE risk_scores SET
  lsi            = 4.1,
  lsi_norm       = 0.82,
  lli_raw        = 3.2,
  lli_norm       = 0.55,
  cei            = 0.082,
  cei_leader_decisions = 11,
  cei_total_decisions  = 134,
  risk_score     = 0.0551,
  risk_level     = 'Early exposure',
  cascade_stage  = 'Emerging Exposure',
  cascade_level  = 2,
  trajectory_direction = 'Improving',
  signal_pattern = 'Strategic Interpreter'
WHERE leader_id = 1 AND score_id = 11;

-- ─── PRIYA KAPOOR (leader_id=4) — Early exposure
UPDATE risk_scores SET
  lsi            = 3.867,
  lsi_norm       = 0.7734,
  lli_raw        = 2.8,
  lli_norm       = 0.45,
  cei            = 0.095,
  cei_leader_decisions = 14,
  cei_total_decisions  = 147,
  risk_score     = 0.0552,
  risk_level     = 'Early exposure',
  cascade_stage  = 'Emerging Exposure',
  cascade_level  = 2,
  trajectory_direction = 'Stable',
  signal_pattern = 'Strategic Interpreter'
WHERE leader_id = 4 AND score_id = 4;

-- ─── SARAH CHEN (leader_id=2) — Low structural risk
UPDATE risk_scores SET
  lsi            = 4.433,
  lsi_norm       = 0.8866,
  lli_raw        = 2.0,
  lli_norm       = 0.25,
  cei            = 0.064,
  cei_leader_decisions = 9,
  cei_total_decisions  = 141,
  risk_score     = 0.0180,
  risk_level     = 'Low structural risk',
  cascade_stage  = 'Healthy Distribution',
  cascade_level  = 1,
  trajectory_direction = 'Improving',
  signal_pattern = 'Organizational Stabilizer'
WHERE leader_id = 2 AND score_id = 2;

-- ─── DECISION EVENTS (30-day window) for Velocity calculation
-- Each leader contributes realistic decision volumes
DELETE FROM decision_events WHERE organization_id = 1;

-- James Rivera — 20 decisions resolved (highest concentration)
INSERT INTO decision_events (leader_id, organization_id, initiated_by, resolved_by, complexity_score, decision_type, timestamp) VALUES
(3,1,10,3,4,'strategic',datetime('now','-1 days')),(3,1,11,3,3,'operational',datetime('now','-2 days')),
(3,1,12,3,5,'strategic',datetime('now','-3 days')),(3,1,13,3,4,'financial',datetime('now','-4 days')),
(3,1,14,3,3,'operational',datetime('now','-5 days')),(3,1,15,3,4,'strategic',datetime('now','-6 days')),
(3,1,16,3,2,'hr',datetime('now','-7 days')),(3,1,17,3,3,'operational',datetime('now','-8 days')),
(3,1,18,3,4,'strategic',datetime('now','-9 days')),(3,1,19,3,3,'financial',datetime('now','-10 days')),
(3,1,20,3,5,'strategic',datetime('now','-11 days')),(3,1,21,3,4,'operational',datetime('now','-12 days')),
(3,1,22,3,3,'hr',datetime('now','-13 days')),(3,1,23,3,4,'strategic',datetime('now','-14 days')),
(3,1,24,3,2,'operational',datetime('now','-15 days')),(3,1,25,3,3,'financial',datetime('now','-16 days')),
(3,1,26,3,4,'strategic',datetime('now','-17 days')),(3,1,27,3,3,'operational',datetime('now','-18 days')),
(3,1,28,3,5,'strategic',datetime('now','-19 days')),(3,1,29,3,4,'financial',datetime('now','-20 days'));

-- David Park — 18 decisions resolved
INSERT INTO decision_events (leader_id, organization_id, initiated_by, resolved_by, complexity_score, decision_type, timestamp) VALUES
(5,1,30,5,3,'operational',datetime('now','-1 days')),(5,1,31,5,4,'strategic',datetime('now','-3 days')),
(5,1,32,5,3,'financial',datetime('now','-5 days')),(5,1,33,5,2,'hr',datetime('now','-7 days')),
(5,1,34,5,4,'strategic',datetime('now','-9 days')),(5,1,35,5,3,'operational',datetime('now','-11 days')),
(5,1,36,5,4,'strategic',datetime('now','-13 days')),(5,1,37,5,3,'financial',datetime('now','-15 days')),
(5,1,38,5,2,'operational',datetime('now','-17 days')),(5,1,39,5,3,'hr',datetime('now','-19 days')),
(5,1,40,5,4,'strategic',datetime('now','-21 days')),(5,1,41,5,3,'operational',datetime('now','-23 days')),
(5,1,42,5,4,'financial',datetime('now','-25 days')),(5,1,43,5,3,'strategic',datetime('now','-26 days')),
(5,1,44,5,2,'hr',datetime('now','-27 days')),(5,1,45,5,3,'operational',datetime('now','-28 days')),
(5,1,46,5,4,'strategic',datetime('now','-29 days')),(5,1,47,5,3,'financial',datetime('now','-30 days'));

-- Alex Morgan — 16 decisions resolved
INSERT INTO decision_events (leader_id, organization_id, initiated_by, resolved_by, complexity_score, decision_type, timestamp) VALUES
(1,1,50,1,5,'strategic',datetime('now','-2 days')),(1,1,51,1,4,'operational',datetime('now','-4 days')),
(1,1,52,1,3,'financial',datetime('now','-6 days')),(1,1,53,1,4,'strategic',datetime('now','-8 days')),
(1,1,54,1,3,'operational',datetime('now','-10 days')),(1,1,55,1,4,'strategic',datetime('now','-12 days')),
(1,1,56,1,2,'hr',datetime('now','-14 days')),(1,1,57,1,4,'financial',datetime('now','-16 days')),
(1,1,58,1,3,'operational',datetime('now','-18 days')),(1,1,59,1,4,'strategic',datetime('now','-20 days')),
(1,1,60,1,3,'hr',datetime('now','-22 days')),(1,1,61,1,4,'strategic',datetime('now','-24 days')),
(1,1,62,1,3,'operational',datetime('now','-26 days')),(1,1,63,1,4,'financial',datetime('now','-27 days')),
(1,1,64,1,3,'strategic',datetime('now','-28 days')),(1,1,65,1,2,'operational',datetime('now','-29 days'));

-- Priya Kapoor — 14 decisions resolved
INSERT INTO decision_events (leader_id, organization_id, initiated_by, resolved_by, complexity_score, decision_type, timestamp) VALUES
(4,1,70,4,3,'strategic',datetime('now','-2 days')),(4,1,71,4,2,'operational',datetime('now','-5 days')),
(4,1,72,4,3,'financial',datetime('now','-8 days')),(4,1,73,4,2,'hr',datetime('now','-11 days')),
(4,1,74,4,3,'strategic',datetime('now','-14 days')),(4,1,75,4,2,'operational',datetime('now','-17 days')),
(4,1,76,4,3,'financial',datetime('now','-20 days')),(4,1,77,4,2,'hr',datetime('now','-23 days')),
(4,1,78,4,3,'strategic',datetime('now','-25 days')),(4,1,79,4,2,'operational',datetime('now','-27 days')),
(4,1,80,4,3,'financial',datetime('now','-28 days')),(4,1,81,4,2,'strategic',datetime('now','-29 days')),
(4,1,82,4,3,'hr',datetime('now','-30 days')),(4,1,83,4,2,'operational',datetime('now','-30 days'));

-- Sarah Chen — 9 decisions resolved (healthiest distribution)
INSERT INTO decision_events (leader_id, organization_id, initiated_by, resolved_by, complexity_score, decision_type, timestamp) VALUES
(2,1,90,2,2,'operational',datetime('now','-3 days')),(2,1,91,2,3,'strategic',datetime('now','-7 days')),
(2,1,92,2,2,'financial',datetime('now','-10 days')),(2,1,93,2,1,'hr',datetime('now','-14 days')),
(2,1,94,2,2,'operational',datetime('now','-18 days')),(2,1,95,2,3,'strategic',datetime('now','-22 days')),
(2,1,96,2,2,'financial',datetime('now','-25 days')),(2,1,97,2,1,'hr',datetime('now','-28 days')),
(2,1,98,2,2,'operational',datetime('now','-30 days'));
