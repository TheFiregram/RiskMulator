-- RiskMulator core schema (v1)

CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    career_rank TEXT NOT NULL DEFAULT 'risk_assessment_intern',
    total_points INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS save_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    slot_name TEXT NOT NULL,
    scene_id TEXT NOT NULL,
    state_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_save_slots_profile ON save_slots(profile_id);

CREATE TABLE IF NOT EXISTS hazard_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    scene_id TEXT NOT NULL,
    hazard_id TEXT NOT NULL,
    classification TEXT,
    likelihood INTEGER,
    severity INTEGER,
    risk_score INTEGER,
    control_measure TEXT,
    photo_path TEXT,
    logged_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hazard_log_profile ON hazard_log(profile_id);

CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    module_id TEXT NOT NULL,
    title TEXT NOT NULL,
    issued_at TEXT NOT NULL DEFAULT (datetime('now'))
);
