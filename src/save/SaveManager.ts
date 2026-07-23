import { DEFAULT_SETTINGS, type GameSettings } from "@/core/types";
import type { HazardLogEntry, ProfileRecord } from "@/tablet/types";
import type { HazardClass } from "@/tablet/risk";

function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export interface HazardCompletion {
  classification: HazardClass;
  likelihood: number;
  severity: number;
  riskScore: number;
  controlMeasure: string;
  points: number;
}

interface PersistenceBackend {
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  /** Returns the default profile, creating it on first run. */
  ensureProfile(): Promise<ProfileRecord>;
  /** Adds points, stores the (re-derived) career rank, returns the new total. */
  addPoints(profileId: number, delta: number, newRank: string): Promise<number>;

  addPhoto(
    profileId: number,
    sceneId: string,
    hazardId: string | null,
    dataUrl: string,
  ): Promise<number>;

  createHazardDraft(
    profileId: number,
    sceneId: string,
    hazardId: string,
    hazardName: string,
    photoId: number,
    points: number,
  ): Promise<number>;
  completeHazardEntry(entryId: number, completion: HazardCompletion): Promise<void>;
  listHazardEntries(profileId: number, sceneId: string): Promise<HazardLogEntry[]>;
}

// ---------------------------------------------------------------------------
// SQLite backend (Tauri desktop build)
// ---------------------------------------------------------------------------

class SqliteBackend implements PersistenceBackend {
  private db: import("@tauri-apps/plugin-sql").default | null = null;

  private async database() {
    if (!this.db) {
      const Database = (await import("@tauri-apps/plugin-sql")).default;
      // Migrations in src-tauri create the schema on first load.
      this.db = await Database.load("sqlite:riskmulator.db");
    }
    return this.db;
  }

  async getSetting(key: string): Promise<string | null> {
    const db = await this.database();
    const rows = await db.select<{ value: string }[]>(
      "SELECT value FROM settings WHERE key = $1",
      [key],
    );
    return rows.length > 0 ? rows[0].value : null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const db = await this.database();
    await db.execute(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2",
      [key, value],
    );
  }

  async ensureProfile(): Promise<ProfileRecord> {
    const db = await this.database();
    const rows = await db.select<
      { id: number; name: string; career_rank: string; total_points: number }[]
    >("SELECT id, name, career_rank, total_points FROM profiles ORDER BY id LIMIT 1");
    if (rows.length > 0) {
      const r = rows[0];
      return { id: r.id, name: r.name, careerRank: r.career_rank, totalPoints: r.total_points };
    }
    const result = await db.execute("INSERT INTO profiles (name) VALUES ($1)", ["Trainee"]);
    return {
      id: result.lastInsertId ?? 1,
      name: "Trainee",
      careerRank: "risk_assessment_intern",
      totalPoints: 0,
    };
  }

  async addPoints(profileId: number, delta: number, newRank: string): Promise<number> {
    const db = await this.database();
    await db.execute(
      "UPDATE profiles SET total_points = total_points + $1, career_rank = $2, updated_at = datetime('now') WHERE id = $3",
      [delta, newRank, profileId],
    );
    const rows = await db.select<{ total_points: number }[]>(
      "SELECT total_points FROM profiles WHERE id = $1",
      [profileId],
    );
    return rows[0]?.total_points ?? 0;
  }

  async addPhoto(
    profileId: number,
    sceneId: string,
    hazardId: string | null,
    dataUrl: string,
  ): Promise<number> {
    const db = await this.database();
    const result = await db.execute(
      "INSERT INTO photos (profile_id, scene_id, hazard_id, data_url) VALUES ($1, $2, $3, $4)",
      [profileId, sceneId, hazardId, dataUrl],
    );
    return result.lastInsertId ?? 0;
  }

  async createHazardDraft(
    profileId: number,
    sceneId: string,
    hazardId: string,
    hazardName: string,
    photoId: number,
    points: number,
  ): Promise<number> {
    const db = await this.database();
    const result = await db.execute(
      `INSERT INTO hazard_log (profile_id, scene_id, hazard_id, hazard_name, status, photo_id, points)
       VALUES ($1, $2, $3, $4, 'draft', $5, $6)`,
      [profileId, sceneId, hazardId, hazardName, photoId, points],
    );
    return result.lastInsertId ?? 0;
  }

  async completeHazardEntry(entryId: number, c: HazardCompletion): Promise<void> {
    const db = await this.database();
    await db.execute(
      `UPDATE hazard_log
       SET status = 'logged', classification = $1, likelihood = $2, severity = $3,
           risk_score = $4, control_measure = $5, points = $6, logged_at = datetime('now')
       WHERE id = $7`,
      [c.classification, c.likelihood, c.severity, c.riskScore, c.controlMeasure, c.points, entryId],
    );
  }

  async listHazardEntries(profileId: number, sceneId: string): Promise<HazardLogEntry[]> {
    const db = await this.database();
    const rows = await db.select<
      {
        id: number;
        scene_id: string;
        hazard_id: string;
        hazard_name: string;
        status: string;
        classification: string | null;
        likelihood: number | null;
        severity: number | null;
        risk_score: number | null;
        control_measure: string | null;
        points: number;
        logged_at: string;
        photo_data_url: string | null;
      }[]
    >(
      `SELECT h.id, h.scene_id, h.hazard_id, h.hazard_name, h.status, h.classification,
              h.likelihood, h.severity, h.risk_score, h.control_measure, h.points, h.logged_at,
              p.data_url AS photo_data_url
       FROM hazard_log h
       LEFT JOIN photos p ON p.id = h.photo_id
       WHERE h.profile_id = $1 AND h.scene_id = $2
       ORDER BY h.id DESC`,
      [profileId, sceneId],
    );
    return rows.map((r) => ({
      id: r.id,
      sceneId: r.scene_id,
      hazardId: r.hazard_id,
      hazardName: r.hazard_name,
      status: r.status === "draft" ? "draft" : "logged",
      classification: (r.classification as HazardClass | null) ?? null,
      likelihood: r.likelihood,
      severity: r.severity,
      riskScore: r.risk_score,
      controlMeasure: r.control_measure,
      points: r.points,
      photoDataUrl: r.photo_data_url,
      loggedAt: r.logged_at,
    }));
  }
}

// ---------------------------------------------------------------------------
// localStorage backend (plain browser dev builds)
// ---------------------------------------------------------------------------

interface StoredPhoto {
  id: number;
  profileId: number;
  sceneId: string;
  hazardId: string | null;
  dataUrl: string;
  takenAt: string;
}

interface StoredHazardEntry extends Omit<HazardLogEntry, "photoDataUrl"> {
  profileId: number;
  photoId: number | null;
}

class LocalStorageBackend implements PersistenceBackend {
  private read<T>(key: string, fallback: T): T {
    const raw = localStorage.getItem(`riskmulator:${key}`);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private write(key: string, value: unknown): void {
    localStorage.setItem(`riskmulator:${key}`, JSON.stringify(value));
  }

  private nextId(key: string): number {
    const id = this.read<number>(`${key}:next-id`, 1);
    this.write(`${key}:next-id`, id + 1);
    return id;
  }

  async getSetting(key: string): Promise<string | null> {
    return localStorage.getItem(`riskmulator:${key}`);
  }

  async setSetting(key: string, value: string): Promise<void> {
    localStorage.setItem(`riskmulator:${key}`, value);
  }

  async ensureProfile(): Promise<ProfileRecord> {
    const existing = this.read<ProfileRecord | null>("profile", null);
    if (existing) return existing;
    const profile: ProfileRecord = {
      id: 1,
      name: "Trainee",
      careerRank: "risk_assessment_intern",
      totalPoints: 0,
    };
    this.write("profile", profile);
    return profile;
  }

  async addPoints(_profileId: number, delta: number, newRank: string): Promise<number> {
    const profile = await this.ensureProfile();
    profile.totalPoints += delta;
    profile.careerRank = newRank;
    this.write("profile", profile);
    return profile.totalPoints;
  }

  async addPhoto(
    profileId: number,
    sceneId: string,
    hazardId: string | null,
    dataUrl: string,
  ): Promise<number> {
    const photos = this.read<StoredPhoto[]>("photos", []);
    const photo: StoredPhoto = {
      id: this.nextId("photos"),
      profileId,
      sceneId,
      hazardId,
      dataUrl,
      takenAt: new Date().toISOString(),
    };
    photos.push(photo);
    this.write("photos", photos);
    return photo.id;
  }

  async createHazardDraft(
    profileId: number,
    sceneId: string,
    hazardId: string,
    hazardName: string,
    photoId: number,
    points: number,
  ): Promise<number> {
    const entries = this.read<StoredHazardEntry[]>("hazard_log", []);
    const entry: StoredHazardEntry = {
      id: this.nextId("hazard_log"),
      profileId,
      sceneId,
      hazardId,
      hazardName,
      status: "draft",
      classification: null,
      likelihood: null,
      severity: null,
      riskScore: null,
      controlMeasure: null,
      points,
      photoId,
      loggedAt: new Date().toISOString(),
    };
    entries.push(entry);
    this.write("hazard_log", entries);
    return entry.id;
  }

  async completeHazardEntry(entryId: number, c: HazardCompletion): Promise<void> {
    const entries = this.read<StoredHazardEntry[]>("hazard_log", []);
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    entry.status = "logged";
    entry.classification = c.classification;
    entry.likelihood = c.likelihood;
    entry.severity = c.severity;
    entry.riskScore = c.riskScore;
    entry.controlMeasure = c.controlMeasure;
    entry.points = c.points;
    entry.loggedAt = new Date().toISOString();
    this.write("hazard_log", entries);
  }

  async listHazardEntries(profileId: number, sceneId: string): Promise<HazardLogEntry[]> {
    const entries = this.read<StoredHazardEntry[]>("hazard_log", []);
    const photos = this.read<StoredPhoto[]>("photos", []);
    return entries
      .filter((e) => e.profileId === profileId && e.sceneId === sceneId)
      .sort((a, b) => b.id - a.id)
      .map((e) => ({
        id: e.id,
        sceneId: e.sceneId,
        hazardId: e.hazardId,
        hazardName: e.hazardName,
        status: e.status,
        classification: e.classification,
        likelihood: e.likelihood,
        severity: e.severity,
        riskScore: e.riskScore,
        controlMeasure: e.controlMeasure,
        points: e.points,
        photoDataUrl: photos.find((p) => p.id === e.photoId)?.dataUrl ?? null,
        loggedAt: e.loggedAt,
      }));
  }
}

// ---------------------------------------------------------------------------

export class SaveManager {
  private backend: PersistenceBackend;

  constructor() {
    this.backend = isTauri() ? new SqliteBackend() : new LocalStorageBackend();
  }

  async loadSettings(): Promise<GameSettings> {
    try {
      const raw = await this.backend.getSetting("game_settings");
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch (err) {
      console.error("Failed to load settings, using defaults:", err);
      return { ...DEFAULT_SETTINGS };
    }
  }

  async saveSettings(settings: GameSettings): Promise<void> {
    try {
      await this.backend.setSetting("game_settings", JSON.stringify(settings));
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  }

  ensureProfile(): Promise<ProfileRecord> {
    return this.backend.ensureProfile();
  }

  addPoints(profileId: number, delta: number, newRank: string): Promise<number> {
    return this.backend.addPoints(profileId, delta, newRank);
  }

  addPhoto(
    profileId: number,
    sceneId: string,
    hazardId: string | null,
    dataUrl: string,
  ): Promise<number> {
    return this.backend.addPhoto(profileId, sceneId, hazardId, dataUrl);
  }

  createHazardDraft(
    profileId: number,
    sceneId: string,
    hazardId: string,
    hazardName: string,
    photoId: number,
    points: number,
  ): Promise<number> {
    return this.backend.createHazardDraft(
      profileId,
      sceneId,
      hazardId,
      hazardName,
      photoId,
      points,
    );
  }

  completeHazardEntry(entryId: number, completion: HazardCompletion): Promise<void> {
    return this.backend.completeHazardEntry(entryId, completion);
  }

  listHazardEntries(profileId: number, sceneId: string): Promise<HazardLogEntry[]> {
    return this.backend.listHazardEntries(profileId, sceneId);
  }
}
