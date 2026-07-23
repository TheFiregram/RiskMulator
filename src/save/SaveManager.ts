import { DEFAULT_SETTINGS, type GameSettings } from "@/core/types";

function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

interface SettingsBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

class SqliteBackend implements SettingsBackend {
  private db: import("@tauri-apps/plugin-sql").default | null = null;

  private async database() {
    if (!this.db) {
      const Database = (await import("@tauri-apps/plugin-sql")).default;
      // Migrations in src-tauri create the schema on first load.
      this.db = await Database.load("sqlite:riskmulator.db");
    }
    return this.db;
  }

  async get(key: string): Promise<string | null> {
    const db = await this.database();
    const rows = await db.select<{ value: string }[]>(
      "SELECT value FROM settings WHERE key = $1",
      [key],
    );
    return rows.length > 0 ? rows[0].value : null;
  }

  async set(key: string, value: string): Promise<void> {
    const db = await this.database();
    await db.execute(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2",
      [key, value],
    );
  }
}

/** Used when running in a plain browser (vite dev without Tauri). */
class LocalStorageBackend implements SettingsBackend {
  async get(key: string): Promise<string | null> {
    return localStorage.getItem(`riskmulator:${key}`);
  }

  async set(key: string, value: string): Promise<void> {
    localStorage.setItem(`riskmulator:${key}`, value);
  }
}

export class SaveManager {
  private backend: SettingsBackend;

  constructor() {
    this.backend = isTauri() ? new SqliteBackend() : new LocalStorageBackend();
  }

  async loadSettings(): Promise<GameSettings> {
    try {
      const raw = await this.backend.get("game_settings");
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
      await this.backend.set("game_settings", JSON.stringify(settings));
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  }
}
