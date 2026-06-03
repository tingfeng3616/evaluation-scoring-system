PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  serial_no INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS candidate_departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id INTEGER NOT NULL,
  department_name TEXT NOT NULL,
  intent_type TEXT NOT NULL CHECK (intent_type IN ('first', 'second')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  UNIQUE (candidate_id, intent_type)
);

CREATE TABLE IF NOT EXISTS device_bindings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('judge', 'member')),
  device_token TEXT NOT NULL UNIQUE,
  fingerprint_hash TEXT,
  user_agent TEXT,
  first_ip TEXT,
  last_ip TEXT,
  bound_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unbound_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unbound'))
);

CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id INTEGER NOT NULL,
  binding_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('judge', 'member')),
  grooming_1 INTEGER NOT NULL,
  grooming_2 INTEGER NOT NULL,
  grooming_3 INTEGER NOT NULL,
  expression_1 INTEGER NOT NULL,
  expression_2 INTEGER NOT NULL,
  expression_3 INTEGER NOT NULL,
  fit_1 INTEGER NOT NULL,
  fit_2 INTEGER NOT NULL,
  fit_3 INTEGER NOT NULL,
  attitude_1 INTEGER NOT NULL,
  attitude_2 INTEGER NOT NULL,
  attitude_3 INTEGER NOT NULL,
  performance_1 INTEGER NOT NULL,
  performance_2 INTEGER NOT NULL,
  performance_3 INTEGER NOT NULL,
  grooming_total INTEGER NOT NULL,
  expression_total INTEGER NOT NULL,
  fit_total INTEGER NOT NULL,
  attitude_total INTEGER NOT NULL,
  performance_total INTEGER NOT NULL,
  grand_total INTEGER NOT NULL,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  FOREIGN KEY (binding_id) REFERENCES device_bindings(id) ON DELETE CASCADE,
  UNIQUE (candidate_id, binding_id)
);

CREATE TABLE IF NOT EXISTS active_candidate (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  candidate_id INTEGER NOT NULL,
  activated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activated_by TEXT NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_type TEXT NOT NULL,
  actor_role TEXT,
  actor_name TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_candidate_departments_department
  ON candidate_departments (department_name, intent_type);

CREATE INDEX IF NOT EXISTS idx_scores_candidate_role
  ON scores (candidate_id, role);

CREATE INDEX IF NOT EXISTS idx_scores_binding
  ON scores (binding_id);

CREATE INDEX IF NOT EXISTS idx_device_bindings_name_role
  ON device_bindings (name, role);
