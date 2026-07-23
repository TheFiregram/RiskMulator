import * as THREE from "three";
import { GraphicsSettings } from "./GraphicsSettings";
import { InputManager } from "./InputManager";
import type { GameScene } from "./GameScene";

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly graphics: GraphicsSettings;
  readonly input: InputManager;

  private clock = new THREE.Clock();
  private activeScene: GameScene | null = null;
  private running = false;
  private rafId = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.graphics = new GraphicsSettings(this.renderer);
    this.input = new InputManager(canvas);

    window.addEventListener("resize", () => this.handleResize());
    this.handleResize();
  }

  setScene(scene: GameScene | null): void {
    if (this.activeScene && this.activeScene !== scene) {
      this.activeScene.dispose();
    }
    this.activeScene = scene;
    if (scene) {
      scene.onResize(window.innerWidth, window.innerHeight);
    }
  }

  get scene(): GameScene | null {
    return this.activeScene;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.1);
      if (this.activeScene) {
        this.activeScene.update(dt);
        this.renderer.render(this.activeScene.scene, this.activeScene.camera);
      }
      this.input.endFrame();
    };
    loop();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private handleResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.activeScene?.onResize(w, h);
  }
}
