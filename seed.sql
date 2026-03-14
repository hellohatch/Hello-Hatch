-- LSI™ Seed Data — Demo Organization & Leaders
-- Password for all demo users: password123

-- Demo org
INSERT OR IGNORE INTO organizations (id, name, type) VALUES (1, 'Acme Ventures Portfolio', 'growth_vc');

-- Admin user: admin@demo.com / password123
INSERT OR IGNORE INTO users (id, org_id, email, name, role, role_level, password_hash)
VALUES (1, 1, 'admin@demo.com', 'Alex Morgan', 'admin', 'C-Suite / Founder',
  '276a0357cdceae7be5122b62eea428d932eb44217510f9a4eef533da3ad2ab93');

-- Sample leaders (all password: password123)
INSERT OR IGNORE INTO users (id, org_id, email, name, role, role_level, password_hash)
VALUES
  (2, 1, 'sarah@demo.com', 'Sarah Chen', 'leader', 'VP / SVP',
   '276a0357cdceae7be5122b62eea428d932eb44217510f9a4eef533da3ad2ab93'),
  (3, 1, 'james@demo.com', 'James Rivera', 'leader', 'Director',
   '276a0357cdceae7be5122b62eea428d932eb44217510f9a4eef533da3ad2ab93'),
  (4, 1, 'priya@demo.com', 'Priya Kapoor', 'leader', 'VP / SVP',
   '276a0357cdceae7be5122b62eea428d932eb44217510f9a4eef533da3ad2ab93');
