import type { GameSettings, QualityPreset } from "@/core/types";

export interface UICallbacks {
  onStartTraining(): void;
  onResume(): void;
  onQuitToMenu(): void;
  onQuitApp(): void;
  onSettingsChanged(settings: GameSettings): void;
  onMessageClosed(): void;
}

export class UIManager {
  private root: HTMLElement;
  private callbacks: UICallbacks;
  private settings: GameSettings;
  private settingsReturnTo: "menu" | "pause" = "menu";

  constructor(root: HTMLElement, settings: GameSettings, callbacks: UICallbacks) {
    this.root = root;
    this.settings = settings;
    this.callbacks = callbacks;
    this.root.innerHTML = this.markup();
    this.bind();
  }

  private screen(id: string): HTMLElement {
    return this.root.querySelector(`#${id}`) as HTMLElement;
  }

  private showOnly(...ids: string[]): void {
    for (const el of this.root.querySelectorAll<HTMLElement>(".screen, .hud")) {
      el.classList.toggle("visible", ids.includes(el.id));
    }
  }

  showMainMenu(): void {
    this.showOnly("screen-menu");
  }

  showLoading(): void {
    this.setLoadingProgress(0);
    this.showOnly("screen-loading");
  }

  setLoadingProgress(fraction: number): void {
    const bar = this.root.querySelector<HTMLElement>("#loading-bar-fill");
    if (bar) bar.style.width = `${Math.round(fraction * 100)}%`;
  }

  showHUD(): void {
    this.showOnly("hud");
  }

  showPause(): void {
    this.showOnly("screen-pause");
  }

  showSettings(returnTo: "menu" | "pause"): void {
    this.settingsReturnTo = returnTo;
    this.syncSettingsForm();
    this.showOnly("screen-settings");
  }

  setInteractPrompt(text: string | null): void {
    const el = this.root.querySelector<HTMLElement>("#interact-prompt");
    if (!el) return;
    el.textContent = text ? `[E] ${text}` : "";
    el.classList.toggle("visible", !!text);
  }

  showMessage(title: string, body: string): void {
    this.setInteractPrompt(null);
    const panel = this.screen("hud-message");
    panel.querySelector("h3")!.textContent = title;
    panel.querySelector("p")!.textContent = body;
    panel.classList.add("visible");
  }

  hideMessage(): void {
    this.screen("hud-message").classList.remove("visible");
  }

  get isMessageOpen(): boolean {
    return this.screen("hud-message").classList.contains("visible");
  }

  updateSettings(settings: GameSettings): void {
    this.settings = settings;
  }

  private syncSettingsForm(): void {
    const q = this.root.querySelector<HTMLSelectElement>("#opt-quality")!;
    const s = this.root.querySelector<HTMLInputElement>("#opt-sensitivity")!;
    const i = this.root.querySelector<HTMLInputElement>("#opt-invert")!;
    const f = this.root.querySelector<HTMLInputElement>("#opt-fov")!;
    q.value = this.settings.quality;
    s.value = String(this.settings.mouseSensitivity);
    i.checked = this.settings.invertY;
    f.value = String(this.settings.fov);
    this.root.querySelector<HTMLElement>("#opt-sensitivity-value")!.textContent =
      this.settings.mouseSensitivity.toFixed(1);
    this.root.querySelector<HTMLElement>("#opt-fov-value")!.textContent = String(this.settings.fov);
  }

  private readSettingsForm(): GameSettings {
    return {
      quality: this.root.querySelector<HTMLSelectElement>("#opt-quality")!.value as QualityPreset,
      mouseSensitivity: parseFloat(
        this.root.querySelector<HTMLInputElement>("#opt-sensitivity")!.value,
      ),
      invertY: this.root.querySelector<HTMLInputElement>("#opt-invert")!.checked,
      fov: parseInt(this.root.querySelector<HTMLInputElement>("#opt-fov")!.value, 10),
    };
  }

  private bind(): void {
    const on = (id: string, fn: () => void) =>
      this.root.querySelector(`#${id}`)!.addEventListener("click", fn);

    on("btn-start", () => this.callbacks.onStartTraining());
    on("btn-menu-settings", () => this.showSettings("menu"));
    on("btn-quit", () => this.callbacks.onQuitApp());

    on("btn-resume", () => this.callbacks.onResume());
    on("btn-pause-settings", () => this.showSettings("pause"));
    on("btn-quit-to-menu", () => this.callbacks.onQuitToMenu());

    on("btn-settings-back", () => {
      const settings = this.readSettingsForm();
      this.settings = settings;
      this.callbacks.onSettingsChanged(settings);
      if (this.settingsReturnTo === "menu") this.showMainMenu();
      else this.showPause();
    });

    on("btn-message-close", () => {
      this.hideMessage();
      this.callbacks.onMessageClosed();
    });

    const sens = this.root.querySelector<HTMLInputElement>("#opt-sensitivity")!;
    sens.addEventListener("input", () => {
      this.root.querySelector<HTMLElement>("#opt-sensitivity-value")!.textContent = parseFloat(
        sens.value,
      ).toFixed(1);
    });
    const fov = this.root.querySelector<HTMLInputElement>("#opt-fov")!;
    fov.addEventListener("input", () => {
      this.root.querySelector<HTMLElement>("#opt-fov-value")!.textContent = fov.value;
    });
  }

  private markup(): string {
    return `
      <div id="screen-menu" class="screen visible">
        <div class="menu-panel">
          <div class="brand">
            <span class="brand-mark">&#9888;</span>
            <h1>RiskMulator</h1>
          </div>
          <p class="tagline">Workplace risk management. Learned by doing.</p>
          <nav class="menu-buttons">
            <button id="btn-start" class="btn btn-primary">Start Training</button>
            <button id="btn-menu-settings" class="btn">Settings</button>
            <button id="btn-quit" class="btn">Quit</button>
          </nav>
          <p class="version">v0.1.0 &mdash; Training Academy Preview</p>
        </div>
      </div>

      <div id="screen-loading" class="screen">
        <div class="loading-panel">
          <h2>Preparing Training Academy&hellip;</h2>
          <div class="loading-bar"><div id="loading-bar-fill"></div></div>
          <p class="loading-tip">Tip: A hazard is anything with the potential to cause harm. Risk is the likelihood that harm occurs, combined with its severity.</p>
        </div>
      </div>

      <div id="screen-pause" class="screen">
        <div class="menu-panel">
          <h2>Paused</h2>
          <nav class="menu-buttons">
            <button id="btn-resume" class="btn btn-primary">Resume</button>
            <button id="btn-pause-settings" class="btn">Settings</button>
            <button id="btn-quit-to-menu" class="btn">Quit to Main Menu</button>
          </nav>
        </div>
      </div>

      <div id="screen-settings" class="screen">
        <div class="menu-panel settings-panel">
          <h2>Settings</h2>
          <div class="setting-row">
            <label for="opt-quality">Graphics quality</label>
            <select id="opt-quality">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div class="setting-row">
            <label for="opt-sensitivity">Mouse sensitivity <span id="opt-sensitivity-value"></span></label>
            <input id="opt-sensitivity" type="range" min="0.2" max="3" step="0.1" />
          </div>
          <div class="setting-row">
            <label for="opt-fov">Field of view <span id="opt-fov-value"></span></label>
            <input id="opt-fov" type="range" min="60" max="100" step="1" />
          </div>
          <div class="setting-row setting-row-inline">
            <label for="opt-invert">Invert Y axis</label>
            <input id="opt-invert" type="checkbox" />
          </div>
          <nav class="menu-buttons">
            <button id="btn-settings-back" class="btn btn-primary">Save &amp; Back</button>
          </nav>
        </div>
      </div>

      <div id="hud" class="hud">
        <div id="crosshair"></div>
        <div id="interact-prompt"></div>
        <div id="hud-message" class="hud-message">
          <h3></h3>
          <p></p>
          <button id="btn-message-close" class="btn btn-primary">Close</button>
        </div>
        <div id="hud-hint">WASD move &nbsp;&bull;&nbsp; Shift sprint &nbsp;&bull;&nbsp; E interact &nbsp;&bull;&nbsp; Esc pause</div>
      </div>
    `;
  }
}
