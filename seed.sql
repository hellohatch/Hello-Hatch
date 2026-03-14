-- Leadership Risk Intelligence™ — Seed Data v3.0
-- Demo credentials: admin@demo.com / password123 | others: Welcome2026!

-- Organization
INSERT OR IGNORE INTO organizations (organization_id, name, industry, employee_count)
VALUES (1, 'Meridian Capital Partners', 'Financial Services', 320);

-- Admin leader (password: password123)
INSERT OR IGNORE INTO leaders (leader_id, organization_id, name, email, title, role_level, system_role, password_hash)
VALUES (1, 1, 'Alex Morgan', 'admin@demo.com', 'Chief Executive Officer', 'C-Suite / Founder', 'admin',
  '39d1767451a56c89d5c0a1a4df0e6f6f4daf42665e2bb8359739bf0622a19293');

-- Demo leaders (password: Welcome2026!)
INSERT OR IGNORE INTO leaders (leader_id, organization_id, name, email, title, role_level, system_role, password_hash)
VALUES
  (2, 1, 'Sarah Chen',    'sarah@demo.com', 'Chief Product Officer',  'C-Suite / Founder', 'leader', '77ae18a2cdb7938ffb33e91c11c7643c703d98cbe32cd809d0c65cafeca402e6'),
  (3, 1, 'James Rivera',  'james@demo.com', 'VP Engineering',         'VP / SVP',          'leader', '77ae18a2cdb7938ffb33e91c11c7643c703d98cbe32cd809d0c65cafeca402e6'),
  (4, 1, 'Priya Kapoor',  'priya@demo.com', 'Director of Operations', 'Director',          'leader', '77ae18a2cdb7938ffb33e91c11c7643c703d98cbe32cd809d0c65cafeca402e6'),
  (5, 1, 'David Park',    'david@demo.com', 'VP Sales',               'VP / SVP',          'leader', '77ae18a2cdb7938ffb33e91c11c7643c703d98cbe32cd809d0c65cafeca402e6');

-- ─────────────────────────────────────────────────────────────
-- ASSESSMENTS — pre-populated with varied risk profiles
-- ─────────────────────────────────────────────────────────────

-- ALEX MORGAN — Structural Bottleneck Risk (High CEI)
INSERT OR IGNORE INTO assessments (assessment_id, leader_id, status, future_orientation, completed_at)
VALUES (1, 1, 'completed', 'To build an organization that makes great decisions without me being present for every one.',
  datetime('now', '-14 days'));

INSERT OR IGNORE INTO assessment_responses (assessment_id, question_id, response_value) VALUES
-- Stress Regulation (avg = 3.4 → some compression)
(1,'Q01',4),(1,'Q02',3),(1,'Q03',4),(1,'Q04',2),(1,'Q05',4),
-- Cognitive Breadth (avg = 4.0 → strong)
(1,'Q06',4),(1,'Q07',4),(1,'Q08',4),(1,'Q09',2),(1,'Q10',5),
-- Trust Climate (avg = 3.8)
(1,'Q11',4),(1,'Q12',4),(1,'Q13',3),(1,'Q14',2),(1,'Q15',4),
-- Ethical Integrity (avg = 4.2)
(1,'Q16',4),(1,'Q17',4),(1,'Q18',2),(1,'Q19',5),(1,'Q20',4),
-- Leadership Durability (avg = 3.2 → eroding)
(1,'Q21',3),(1,'Q22',3),(1,'Q23',2),(1,'Q24',4),(1,'Q25',2),
-- Adaptive Capacity (avg = 3.6)
(1,'Q26',4),(1,'Q27',4),(1,'Q28',2),(1,'Q29',4),(1,'Q30',3),
-- Load questions (avg = 4.4 → very high)
(1,'Q31',5),(1,'Q32',5),(1,'Q33',4),(1,'Q34',4),(1,'Q35',4);

INSERT OR IGNORE INTO risk_scores (
  score_id, assessment_id, leader_id, organization_id,
  stress_regulation, cognitive_breadth, trust_climate, ethical_integrity,
  leadership_durability, adaptive_capacity,
  lsi, domain_variance, signal_pattern,
  lli_raw, lli_norm,
  cei, cei_total_decisions, cei_leader_decisions,
  cascade_stage, cascade_level,
  risk_score, risk_level, trajectory_direction
) VALUES (
  1, 1, 1, 1,
  3.4, 4.0, 3.8, 4.2, 3.2, 3.6,
  3.700, 0.321, 'Structural Bottleneck Risk',
  4.4, 0.850,
  0.620, 100, 62,
  'Structural Dependency', 3,
  0.1423, 'Emerging dependency', 'Stable'
);

-- SARAH CHEN — Organizational Stabilizer (low risk)
INSERT OR IGNORE INTO assessments (assessment_id, leader_id, status, future_orientation, completed_at)
VALUES (2, 2, 'completed', 'To be known as the leader who helped our team make its best decisions.',
  datetime('now', '-10 days'));

INSERT OR IGNORE INTO assessment_responses (assessment_id, question_id, response_value) VALUES
-- Stress Regulation (avg = 4.4 → strong)
(2,'Q01',5),(2,'Q02',4),(2,'Q03',4),(2,'Q04',2),(2,'Q05',5),
-- Cognitive Breadth (avg = 4.2)
(2,'Q06',4),(2,'Q07',5),(2,'Q08',4),(2,'Q09',2),(2,'Q10',5),
-- Trust Climate (avg = 4.6)
(2,'Q11',5),(2,'Q12',5),(2,'Q13',5),(2,'Q14',1),(2,'Q15',5),
-- Ethical Integrity (avg = 4.6)
(2,'Q16',5),(2,'Q17',4),(2,'Q18',1),(2,'Q19',5),(2,'Q20',5),
-- Leadership Durability (avg = 4.4)
(2,'Q21',4),(2,'Q22',5),(2,'Q23',1),(2,'Q24',5),(2,'Q25',1),
-- Adaptive Capacity (avg = 4.4)
(2,'Q26',5),(2,'Q27',4),(2,'Q28',1),(2,'Q29',5),(2,'Q30',1),
-- Load questions (avg = 2.8 → moderate)
(2,'Q31',3),(2,'Q32',2),(2,'Q33',3),(2,'Q34',3),(2,'Q35',3);

INSERT OR IGNORE INTO risk_scores (
  score_id, assessment_id, leader_id, organization_id,
  stress_regulation, cognitive_breadth, trust_climate, ethical_integrity,
  leadership_durability, adaptive_capacity,
  lsi, domain_variance, signal_pattern,
  lli_raw, lli_norm,
  cei, cei_total_decisions, cei_leader_decisions,
  cascade_stage, cascade_level,
  risk_score, risk_level, trajectory_direction
) VALUES (
  2, 2, 2, 1,
  4.4, 4.2, 4.6, 4.6, 4.4, 4.4,
  4.433, 0.156, 'Organizational Stabilizer',
  2.8, 0.450,
  0.210, 100, 21,
  'Emerging Exposure', 2,
  0.0213, 'Low structural risk', 'Improving'
);

-- JAMES RIVERA — Leadership Load Saturation (very high risk)
INSERT OR IGNORE INTO assessments (assessment_id, leader_id, status, future_orientation, completed_at)
VALUES (3, 3, 'completed', 'To scale our engineering capability beyond what any single person can deliver.',
  datetime('now', '-5 days'));

INSERT OR IGNORE INTO assessment_responses (assessment_id, question_id, response_value) VALUES
-- Stress Regulation (avg = 2.4 → compromised)
(3,'Q01',2),(3,'Q02',2),(3,'Q03',3),(3,'Q04',4),(3,'Q05',2),
-- Cognitive Breadth (avg = 3.4)
(3,'Q06',4),(3,'Q07',3),(3,'Q08',3),(3,'Q09',3),(3,'Q10',4),
-- Trust Climate (avg = 3.0)
(3,'Q11',3),(3,'Q12',3),(3,'Q13',3),(3,'Q14',3),(3,'Q15',3),
-- Ethical Integrity (avg = 3.8)
(3,'Q16',4),(3,'Q17',4),(3,'Q18',2),(3,'Q19',4),(3,'Q20',4),
-- Leadership Durability (avg = 2.0 → critical)
(3,'Q21',2),(3,'Q22',2),(3,'Q23',4),(3,'Q24',2),(3,'Q25',4),
-- Adaptive Capacity (avg = 2.8)
(3,'Q26',3),(3,'Q27',3),(3,'Q28',3),(3,'Q29',3),(3,'Q30',3),
-- Load questions (avg = 4.8 → maxed)
(3,'Q31',5),(3,'Q32',5),(3,'Q33',5),(3,'Q34',5),(3,'Q35',4);

INSERT OR IGNORE INTO risk_scores (
  score_id, assessment_id, leader_id, organization_id,
  stress_regulation, cognitive_breadth, trust_climate, ethical_integrity,
  leadership_durability, adaptive_capacity,
  lsi, domain_variance, signal_pattern,
  lli_raw, lli_norm,
  cei, cei_total_decisions, cei_leader_decisions,
  cascade_stage, cascade_level,
  risk_score, risk_level, trajectory_direction
) VALUES (
  3, 3, 3, 1,
  2.4, 3.4, 3.0, 3.8, 2.0, 2.8,
  2.900, 0.580, 'Leadership Load Saturation',
  4.8, 0.950,
  0.720, 100, 72,
  'Decision Bottleneck', 4,
  0.2359, 'Structural bottleneck', 'Declining'
);

-- PRIYA KAPOOR — Strategic Interpreter (moderate risk)
INSERT OR IGNORE INTO assessments (assessment_id, leader_id, status, future_orientation, completed_at)
VALUES (4, 4, 'completed', 'To be a leader who translates complexity into clear paths forward for my team.',
  datetime('now', '-7 days'));

INSERT OR IGNORE INTO assessment_responses (assessment_id, question_id, response_value) VALUES
-- Stress Regulation (avg = 3.8)
(4,'Q01',4),(4,'Q02',4),(4,'Q03',4),(4,'Q04',2),(4,'Q05',4),
-- Cognitive Breadth (avg = 4.4 → very strong)
(4,'Q06',5),(4,'Q07',5),(4,'Q08',4),(4,'Q09',2),(4,'Q10',5),
-- Trust Climate (avg = 3.6)
(4,'Q11',4),(4,'Q12',4),(4,'Q13',3),(4,'Q14',3),(4,'Q15',4),
-- Ethical Integrity (avg = 4.4 → very strong)
(4,'Q16',5),(4,'Q17',4),(4,'Q18',2),(4,'Q19',5),(4,'Q20',4),
-- Leadership Durability (avg = 3.4)
(4,'Q21',3),(4,'Q22',4),(4,'Q23',3),(4,'Q24',3),(4,'Q25',3),
-- Adaptive Capacity (avg = 3.6)
(4,'Q26',4),(4,'Q27',4),(4,'Q28',2),(4,'Q29',4),(4,'Q30',3),
-- Load questions (avg = 3.6 → moderate-high)
(4,'Q31',4),(4,'Q32',4),(4,'Q33',3),(4,'Q34',4),(4,'Q35',3);

INSERT OR IGNORE INTO risk_scores (
  score_id, assessment_id, leader_id, organization_id,
  stress_regulation, cognitive_breadth, trust_climate, ethical_integrity,
  leadership_durability, adaptive_capacity,
  lsi, domain_variance, signal_pattern,
  lli_raw, lli_norm,
  cei, cei_total_decisions, cei_leader_decisions,
  cascade_stage, cascade_level,
  risk_score, risk_level, trajectory_direction
) VALUES (
  4, 4, 4, 1,
  3.8, 4.4, 3.6, 4.4, 3.4, 3.6,
  3.867, 0.372, 'Strategic Interpreter',
  3.6, 0.650,
  0.430, 100, 43,
  'Emerging Exposure', 2,
  0.0722, 'Early exposure', 'Stable'
);

-- DAVID PARK — Emerging Bottleneck
INSERT OR IGNORE INTO assessments (assessment_id, leader_id, status, future_orientation, completed_at)
VALUES (5, 5, 'completed', 'To build a self-sustaining sales organization that exceeds targets without my daily oversight.',
  datetime('now', '-3 days'));

INSERT OR IGNORE INTO assessment_responses (assessment_id, question_id, response_value) VALUES
-- Stress Regulation (avg = 3.2)
(5,'Q01',3),(5,'Q02',3),(5,'Q03',3),(5,'Q04',3),(5,'Q05',4),
-- Cognitive Breadth (avg = 3.6)
(5,'Q06',4),(5,'Q07',4),(5,'Q08',3),(5,'Q09',2),(5,'Q10',4),
-- Trust Climate (avg = 3.4)
(5,'Q11',4),(5,'Q12',3),(5,'Q13',3),(5,'Q14',3),(5,'Q15',4),
-- Ethical Integrity (avg = 3.8)
(5,'Q16',4),(5,'Q17',4),(5,'Q18',2),(5,'Q19',4),(5,'Q20',4),
-- Leadership Durability (avg = 3.0)
(5,'Q21',3),(5,'Q22',3),(5,'Q23',3),(5,'Q24',3),(5,'Q25',3),
-- Adaptive Capacity (avg = 3.4)
(5,'Q26',3),(5,'Q27',4),(5,'Q28',3),(5,'Q29',4),(5,'Q30',3),
-- Load questions (avg = 4.0)
(5,'Q31',4),(5,'Q32',4),(5,'Q33',4),(5,'Q34',4),(5,'Q35',4);

INSERT OR IGNORE INTO risk_scores (
  score_id, assessment_id, leader_id, organization_id,
  stress_regulation, cognitive_breadth, trust_climate, ethical_integrity,
  leadership_durability, adaptive_capacity,
  lsi, domain_variance, signal_pattern,
  lli_raw, lli_norm,
  cei, cei_total_decisions, cei_leader_decisions,
  cascade_stage, cascade_level,
  risk_score, risk_level, trajectory_direction
) VALUES (
  5, 5, 5, 1,
  3.2, 3.6, 3.4, 3.8, 3.0, 3.4,
  3.400, 0.256, 'Structural Bottleneck Risk',
  4.0, 0.750,
  0.510, 100, 51,
  'Structural Dependency', 3,
  0.1123, 'Emerging dependency', 'Declining'
);

-- Historical scores for Alex (trajectory)
INSERT OR IGNORE INTO assessments (assessment_id, leader_id, status, completed_at)
VALUES
  (10, 1, 'completed', datetime('now', '-75 days')),
  (11, 1, 'completed', datetime('now', '-45 days'));

INSERT OR IGNORE INTO risk_scores (score_id, assessment_id, leader_id, organization_id,
  stress_regulation, cognitive_breadth, trust_climate, ethical_integrity,
  leadership_durability, adaptive_capacity, lsi, domain_variance, signal_pattern,
  lli_raw, lli_norm, cei, cei_total_decisions, cei_leader_decisions,
  cascade_stage, cascade_level, risk_score, risk_level, trajectory_direction)
VALUES
  (10, 10, 1, 1, 3.8, 4.2, 4.0, 4.4, 3.6, 3.8, 3.967, 0.241, 'Organizational Stabilizer',
   3.8, 0.700, 0.420, 100, 42, 'Emerging Exposure', 2, 0.0740, 'Early exposure', 'Stable'),
  (11, 11, 1, 1, 3.6, 4.0, 3.9, 4.3, 3.4, 3.7, 3.817, 0.285, 'Structural Bottleneck Risk',
   4.1, 0.775, 0.540, 100, 54, 'Structural Dependency', 3, 0.1108, 'Emerging dependency', 'Declining');

-- Decision events
INSERT OR IGNORE INTO decision_events (decision_id, leader_id, organization_id, resolved_by, decision_type, timestamp)
VALUES
  (1,  1, 1, 1, 'strategic',    datetime('now', '-2 days')),
  (2,  1, 1, 1, 'operational',  datetime('now', '-2 days')),
  (3,  1, 1, 1, 'strategic',    datetime('now', '-3 days')),
  (4,  1, 1, 1, 'personnel',    datetime('now', '-4 days')),
  (5,  2, 1, 2, 'operational',  datetime('now', '-1 days')),
  (6,  3, 1, 3, 'technical',    datetime('now', '-1 days')),
  (7,  3, 1, 3, 'technical',    datetime('now', '-2 days')),
  (8,  4, 1, 4, 'operational',  datetime('now', '-1 days')),
  (9,  5, 1, 5, 'commercial',   datetime('now', '-1 days')),
  (10, 5, 1, 5, 'commercial',   datetime('now', '-2 days'));
