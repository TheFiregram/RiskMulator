-- Inspection reports (v3): filed when a scene's hazards are fully assessed.

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    scene_id TEXT NOT NULL,
    title TEXT NOT NULL,
    summary_json TEXT NOT NULL,
    filed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reports_profile ON reports(profile_id);
