import { Engine } from "@/core/Engine";
import { GraphicsSettings } from "@/core/GraphicsSettings";
import { SaveManager } from "@/save/SaveManager";
import { UIManager } from "@/ui/UIManager";
import { WhiteRoomScene } from "@/scenes/WhiteRoomScene";
import type { GameSettings, GameState } from "@/core/types";

class Game {
  private engine: Engine;
  private save = new SaveManager();
  private ui!: UIManager;
  private settings!: GameSettings;
  private state: GameState = "menu";
  private room: WhiteRoomScene | null = null;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.engine = new Engine(canvas);
    void this.boot(uiRoot);
  }

  private async boot(uiRoot: HTMLElement): Promise<void> {
    this.settings = await this.save.loadSettings();
    if (!localStorage.getItem("riskmulator:quality-detected")) {
      this.settings.quality = GraphicsSettings.detectDefault();
      localStorage.setItem("riskmulator:quality-detected", "1");
      await this.save.saveSettings(this.settings);
    }
    this.engine.graphics.apply(this.settings.quality);

    this.ui = new UIManager(uiRoot, this.settings, {
      onStartTraining: () => void this.startTraining(),
      onResume: () => void this.resume(),
      onQuitToMenu: () => this.quitToMenu(),
      onQuitApp: () => void this.quitApp(),
      onSettingsChanged: (s) => void this.applySettings(s),
      onMessageClosed: () => {
        if (this.state === "playing") {
          this.engine.input.setEnabled(true);
          void this.engine.input.requestPointerLock();
        }
      },
    });

    // Clicking the world while playing but unlocked (e.g. after reading a
    // message) re-captures the mouse.
    this.engine.renderer.domElement.addEventListener("click", () => {
      if (this.state === "playing" && !this.ui.isMessageOpen) {
        void this.engine.input.requestPointerLock();
      }
    });

    this.engine.input.onPointerLockChange = (locked) => {
      if (!locked && this.state === "playing" && !this.ui.isMessageOpen) {
        this.pause();
      }
    };

    this.engine.start();
    this.ui.showMainMenu();
  }

  private async startTraining(): Promise<void> {
    this.state = "loading";
    this.ui.showLoading();

    const room = new WhiteRoomScene(this.engine, this.settings);
    room.onShowMessage = (title, body) => {
      this.ui.showMessage(title, body);
      this.engine.input.setEnabled(false);
      this.engine.input.exitPointerLock();
    };
    room.interaction.onFocusChange = (i) => this.ui.setInteractPrompt(i ? i.prompt : null);

    await room.load((f) => this.ui.setLoadingProgress(f));

    this.room = room;
    this.engine.setScene(room);
    this.state = "playing";
    this.ui.showHUD();
    this.engine.input.setEnabled(true);
    await this.engine.input.requestPointerLock();
  }

  private pause(): void {
    this.state = "paused";
    this.engine.input.setEnabled(false);
    this.ui.showPause();
  }

  private async resume(): Promise<void> {
    this.state = "playing";
    this.ui.showHUD();
    this.engine.input.setEnabled(true);
    await this.engine.input.requestPointerLock();
  }

  private quitToMenu(): void {
    this.state = "menu";
    this.engine.input.setEnabled(false);
    this.engine.input.exitPointerLock();
    this.engine.setScene(null);
    this.room = null;
    this.ui.showMainMenu();
  }

  private async quitApp(): Promise<void> {
    if ("__TAURI_INTERNALS__" in window) {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } else {
      window.close();
    }
  }

  private async applySettings(settings: GameSettings): Promise<void> {
    this.settings = settings;
    this.engine.graphics.apply(settings.quality);
    this.room?.player.applySettings(settings);
    this.ui.updateSettings(settings);
    await this.save.saveSettings(settings);
  }
}

const canvas = document.querySelector<HTMLCanvasElement>("#viewport")!;
const uiRoot = document.querySelector<HTMLElement>("#ui-root")!;
new Game(canvas, uiRoot);
