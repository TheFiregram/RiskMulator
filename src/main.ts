import { Engine } from "@/core/Engine";
import { GraphicsSettings } from "@/core/GraphicsSettings";
import { SaveManager } from "@/save/SaveManager";
import { UIManager } from "@/ui/UIManager";
import { TabletSystem } from "@/tablet/TabletSystem";
import { WhiteRoomScene } from "@/scenes/WhiteRoomScene";
import type { GameSettings, GameState } from "@/core/types";

class Game {
  private engine: Engine;
  private save = new SaveManager();
  private ui!: UIManager;
  private tablet!: TabletSystem;
  private settings!: GameSettings;
  private state: GameState = "menu";
  private room: WhiteRoomScene | null = null;
  private lockFallback = false;

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
          void this.engagePointerLock();
        }
      },
    });

    this.tablet = new TabletSystem(uiRoot, this.save, this.engine, {
      onOverlayOpened: () => {
        this.engine.input.setEnabled(false);
        this.engine.input.exitPointerLock();
        this.engine.input.setFallbackLook(false);
        this.ui.setInteractPrompt(null);
      },
      onOverlayClosed: () => {
        if (this.state === "playing") {
          this.engine.input.setEnabled(true);
          void this.engagePointerLock();
        }
      },
      setCameraMode: (on) => this.ui.setCameraMode(on),
      flashCapture: () => this.ui.flashCapture(),
      showToast: (text) => this.ui.showToast(text),
    });

    this.bindTabletInput();

    // Clicking the world while playing but unlocked (e.g. after reading a
    // message) re-captures the mouse.
    this.engine.renderer.domElement.addEventListener("click", () => {
      if (this.state === "playing" && !this.ui.isMessageOpen && !this.tablet.isOpen) {
        void this.engine.input.requestPointerLock();
      }
    });

    this.engine.input.onPointerLockChange = (locked) => {
      if (locked) {
        // A real lock engaged — leave fallback-look if we were in it.
        this.lockFallback = false;
        this.engine.input.setFallbackLook(false);
      } else if (this.state === "playing" && !this.ui.isMessageOpen && !this.tablet.isOpen) {
        this.pause();
      }
    };

    this.engine.start();
    this.ui.showMainMenu();
  }

  /**
   * Engages mouse-look: pointer lock where available, otherwise (or when the
   * WebView silently refuses — WKWebView does) a cursor-based fallback.
   */
  private async engagePointerLock(): Promise<void> {
    const input = this.engine.input;
    if (this.lockFallback || !input.isPointerLockSupported) {
      input.setFallbackLook(true);
      return;
    }
    await input.requestPointerLock();
    setTimeout(() => {
      if (
        this.state === "playing" &&
        !input.isPointerLocked &&
        !this.ui.isMessageOpen &&
        !this.tablet.isOpen
      ) {
        this.lockFallback = true;
        input.setFallbackLook(true);
      }
    }, 400);
  }

  private bindTabletInput(): void {
    document.addEventListener("keydown", (e) => {
      if (this.state !== "playing") return;
      if (e.code === "Tab") {
        // Keep focus in the game; Tab is the tablet key.
        e.preventDefault();
        if (!this.ui.isMessageOpen) this.tablet.toggleTablet();
      } else if (e.code === "KeyQ" && this.tablet.isCameraMode) {
        this.tablet.exitCameraMode();
      } else if (e.code === "Escape" && this.tablet.isOpen) {
        // Pointer is already unlocked while the tablet is open, so Esc will
        // not trigger the pause path — close the tablet instead.
        this.tablet.closeTablet();
      } else if (
        e.code === "Escape" &&
        !this.ui.isMessageOpen &&
        !this.engine.input.isPointerLocked
      ) {
        // Fallback-look mode has no pointer lock for Esc to break out of, so
        // pause directly.
        this.pause();
      }
    });

    this.engine.renderer.domElement.addEventListener("mousedown", (e) => {
      if (
        e.button === 0 &&
        this.state === "playing" &&
        this.tablet.isCameraMode &&
        this.engine.input.isLookEngaged &&
        this.room
      ) {
        void this.tablet.capturePhoto(this.room.player.camera);
      }
    });
  }

  private async startTraining(): Promise<void> {
    this.state = "loading";
    this.ui.showLoading();

    const room = new WhiteRoomScene(this.engine, this.settings);
    room.onShowMessage = (title, body) => {
      this.ui.showMessage(title, body);
      this.engine.input.setEnabled(false);
      this.engine.input.exitPointerLock();
      this.engine.input.setFallbackLook(false);
    };
    room.interaction.onFocusChange = (i) => this.ui.setInteractPrompt(i ? i.prompt : null);

    await room.load((f) => this.ui.setLoadingProgress(f));
    await this.tablet.startSession(room.id, room.hazards);

    this.room = room;
    this.engine.setScene(room);
    this.state = "playing";
    this.ui.showHUD();
    this.engine.input.setEnabled(true);
    await this.engagePointerLock();
  }

  private pause(): void {
    this.state = "paused";
    this.engine.input.setEnabled(false);
    this.engine.input.setFallbackLook(false);
    this.ui.showPause();
  }

  private async resume(): Promise<void> {
    this.state = "playing";
    this.ui.showHUD();
    this.engine.input.setEnabled(true);
    await this.engagePointerLock();
  }

  private quitToMenu(): void {
    this.state = "menu";
    this.engine.input.setEnabled(false);
    this.engine.input.exitPointerLock();
    this.engine.input.setFallbackLook(false);
    this.tablet.endSession();
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

// three r162 renders through WebGL2 or WebGL1 (old macOS WebViews only have
// WebGL1). Probe on a throwaway canvas so the real one stays untouched, and
// fail with a readable message instead of a blank screen if neither exists.
{
  const probe = document.createElement("canvas");
  if (!probe.getContext("webgl2") && !probe.getContext("webgl")) {
    throw new Error(
      "WebGL is not available in this WebView. RiskMulator needs hardware-accelerated graphics — check that your system supports WebGL and that acceleration is enabled.",
    );
  }
}

new Game(canvas, uiRoot);
