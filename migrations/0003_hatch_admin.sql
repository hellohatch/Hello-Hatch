-- migrations/0003_hatch_admin.sql
-- Hatch Admin tier: adds hatch_admin system_role support
-- Hatch Internal org is seeded here.
-- Admin accounts must be created via the Platform UI at /hatch-admin

INSERT OR IGNORE INTO organizations (organization_id, name, industry, employee_count)
VALUES (999, 'Hatch Internal', 'Technology', 0);
