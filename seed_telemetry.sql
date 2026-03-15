-- Telemetry Demo Seed v1.0
-- Provides realistic structural telemetry snapshots for all 5 demo leaders
-- Each snapshot calibrated to produce meaningful divergence patterns
-- ─────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────
-- LEADER 3: James Rivera — C-Suite / Founder
-- Pattern: CONFIRMED OVERLOAD — high perceived + high telemetry load
-- Scenario: CEO with full routing bottleneck
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO telemetry_snapshots (
  leader_id, organization_id, source_system, period_weeks, data_completeness_pct,
  meeting_hours_per_week, decision_approvals_per_week, cross_functional_meetings_pct,
  recurring_meeting_hours_pct, calendar_fragmentation_score,
  approvals_requiring_this_leader_pct, escalation_frequency_per_week,
  decision_routing_dependencies, cross_func_approval_concentration,
  active_projects_owned, functions_dependent_count, routing_dependency_breadth, single_point_of_failure_score,
  weeks_sustained_overload, calendar_whitespace_pct, after_hours_meetings_pct, weekend_activity_days_per_month,
  tli, tci, rpi, telemetry_composite, data_confidence
) VALUES (
  3, 1, 'calendar+ticketing', 8, 92,
  38, 42, 72, 68, 65,           -- Operational Load: very high meeting hours, high approvals
  52, 11, 9, 58,                -- Decision Routing: majority of decisions route through this leader
  12, 7, 10, 75,                -- Structural Dependency: 12 projects, 7 functions
  8, 8, 28, 3,                  -- Recovery: 8 weeks sustained, only 8% whitespace, 28% after-hours
  0.7444, 0.6325, 0.6588, 0.7084, 0.9020  -- Computed indexes
);

-- ─────────────────────────────────────────────────────────────────────────
-- LEADER 1: Alex Morgan — VP Operations
-- Pattern: HIDDEN DEPENDENCY — low perceived CEI but high telemetry TCI
-- Scenario: Leader doesn't perceive the routing dependency they represent
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO telemetry_snapshots (
  leader_id, organization_id, source_system, period_weeks, data_completeness_pct,
  meeting_hours_per_week, decision_approvals_per_week, cross_functional_meetings_pct,
  recurring_meeting_hours_pct, calendar_fragmentation_score,
  approvals_requiring_this_leader_pct, escalation_frequency_per_week,
  decision_routing_dependencies, cross_func_approval_concentration,
  active_projects_owned, functions_dependent_count, routing_dependency_breadth, single_point_of_failure_score,
  weeks_sustained_overload, calendar_whitespace_pct, after_hours_meetings_pct, weekend_activity_days_per_month,
  tli, tci, rpi, telemetry_composite, data_confidence
) VALUES (
  1, 1, 'calendar+workflow', 6, 85,
  28, 24, 58, 52, 48,           -- Operational Load: elevated but manageable
  38, 7, 8, 44,                 -- Decision Routing: higher than perceived (hidden dep)
  9, 6, 8, 55,                  -- Structural Dependency: significant but not self-perceived
  3, 22, 18, 1,                 -- Recovery: mild compression
  0.5233, 0.4856, 0.3175, 0.4934, 0.8550  -- Computed indexes
);

-- ─────────────────────────────────────────────────────────────────────────
-- LEADER 5: David Park — Director Product
-- Pattern: STRUCTURAL MISALIGNMENT — telemetry high, perception low
-- Scenario: Early stage risk accumulating before leader perceives it
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO telemetry_snapshots (
  leader_id, organization_id, source_system, period_weeks, data_completeness_pct,
  meeting_hours_per_week, decision_approvals_per_week, cross_functional_meetings_pct,
  recurring_meeting_hours_pct, calendar_fragmentation_score,
  approvals_requiring_this_leader_pct, escalation_frequency_per_week,
  decision_routing_dependencies, cross_func_approval_concentration,
  active_projects_owned, functions_dependent_count, routing_dependency_breadth, single_point_of_failure_score,
  weeks_sustained_overload, calendar_whitespace_pct, after_hours_meetings_pct, weekend_activity_days_per_month,
  tli, tci, rpi, telemetry_composite, data_confidence
) VALUES (
  5, 1, 'calendar+jira', 4, 78,
  32, 18, 52, 44, 55,           -- Operational Load: moderate but rising
  28, 5, 6, 32,                 -- Decision Routing: moderate routing concentration
  6, 4, 5, 35,                  -- Structural Dependency: growing
  4, 25, 22, 2,                 -- Recovery: early compression signs
  0.5611, 0.3444, 0.3963, 0.4953, 0.7800  -- Computed indexes
);

-- ─────────────────────────────────────────────────────────────────────────
-- LEADER 4: Priya Kapoor — Senior Director Engineering  
-- Pattern: PERCEPTION STRAIN — high perceived load, lower telemetry
-- Scenario: Role ambiguity amplifying psychological burden
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO telemetry_snapshots (
  leader_id, organization_id, source_system, period_weeks, data_completeness_pct,
  meeting_hours_per_week, decision_approvals_per_week, cross_functional_meetings_pct,
  recurring_meeting_hours_pct, calendar_fragmentation_score,
  approvals_requiring_this_leader_pct, escalation_frequency_per_week,
  decision_routing_dependencies, cross_func_approval_concentration,
  active_projects_owned, functions_dependent_count, routing_dependency_breadth, single_point_of_failure_score,
  weeks_sustained_overload, calendar_whitespace_pct, after_hours_meetings_pct, weekend_activity_days_per_month,
  tli, tci, rpi, telemetry_composite, data_confidence
) VALUES (
  4, 1, 'calendar', 4, 70,
  18, 8, 32, 38, 28,            -- Operational Load: moderate (lower than perceived LLI 0.75)
  12, 2, 3, 15,                 -- Decision Routing: low (lower than perceived CEI 0.095)
  3, 2, 3, 20,                  -- Structural Dependency: low
  1, 38, 8, 0,                  -- Recovery: intact
  0.2711, 0.1667, 0.1394, 0.2018, 0.7000  -- Computed indexes
);

-- ─────────────────────────────────────────────────────────────────────────
-- LEADER 2: Sarah Chen — VP Growth & Strategy
-- Pattern: CONFIRMED STABILITY — both sources show low risk
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO telemetry_snapshots (
  leader_id, organization_id, source_system, period_weeks, data_completeness_pct,
  meeting_hours_per_week, decision_approvals_per_week, cross_functional_meetings_pct,
  recurring_meeting_hours_pct, calendar_fragmentation_score,
  approvals_requiring_this_leader_pct, escalation_frequency_per_week,
  decision_routing_dependencies, cross_func_approval_concentration,
  active_projects_owned, functions_dependent_count, routing_dependency_breadth, single_point_of_failure_score,
  weeks_sustained_overload, calendar_whitespace_pct, after_hours_meetings_pct, weekend_activity_days_per_month,
  tli, tci, rpi, telemetry_composite, data_confidence
) VALUES (
  2, 1, 'calendar+hr', 6, 95,
  14, 5, 28, 30, 18,            -- Operational Load: low
  8, 1, 2, 10,                  -- Decision Routing: well distributed
  2, 1, 2, 10,                  -- Structural Dependency: minimal
  0, 48, 4, 0,                  -- Recovery: healthy whitespace, no after-hours
  0.1956, 0.1122, 0.0413, 0.1409, 0.9500  -- Computed indexes
);

-- Insert telemetry source configs for the demo org
INSERT OR IGNORE INTO telemetry_source_configs (organization_id, source_type, source_label, is_active, sync_frequency_days, notes)
VALUES
  (1, 'calendar',     'Google Workspace Calendar',  1, 7,  'Synced weekly. Meeting metadata only.'),
  (1, 'ticketing',    'Jira / Linear',              1, 7,  'Approval routing and escalation patterns.'),
  (1, 'workflow',     'Workflow & Approvals',        1, 14, 'Decision routing metadata.'),
  (1, 'hr_system',    'HRIS Reporting Structure',    0, 30, 'Not yet connected. Span of control data pending.'),
  (1, 'collaboration','Slack Metadata',              0, 7,  'Pending privacy review. No message content.');
