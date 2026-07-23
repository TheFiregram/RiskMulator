-- Tablet system (v2): photo storage and hazard log workflow.

CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    scene_id TEXT NOT NULL,
    hazard_id TEXT,
    data_url TEXT NOT NULL,
    taken_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_photos_profile ON photos(profile_id);

-- Hazard log becomes a two-step workflow: a 'draft' row is created when the
-- hazard is photographed, then completed to 'logged' by the assessment.
ALTER TABLE hazard_log ADD COLUMN hazard_name TEXT NOT NULL DEFAULT '';
ALTER TABLE hazard_log ADD COLUMN status TEXT NOT NULL DEFAULT 'logged';
ALTER TABLE hazard_log ADD COLUMN photo_id INTEGER REFERENCES photos(id);
ALTER TABLE hazard_log ADD COLUMN points INTEGER NOT NULL DEFAULT 0;
