export interface MouseDelta {
  x: number;
  y: number;
}

export class InputManager {
  private keys = new Set<string>();
  private pressedThisFrame = new Set<string>();
  private mouseDelta: MouseDelta = { x: 0, y: 0 };
  private canvas: HTMLCanvasElement;
  private enabled = false;

  onPointerLockChange?: (locked: boolean) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    document.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressedThisFrame.add(e.code);
    });
    document.addEventListener("keyup", (e) => this.keys.delete(e.code));
    document.addEventListener("mousemove", (e) => {
      if (!this.isPointerLocked) return;
      this.mouseDelta.x += e.movementX;
      this.mouseDelta.y += e.movementY;
    });
    document.addEventListener("pointerlockchange", () => {
      this.onPointerLockChange?.(this.isPointerLocked);
    });
    // Losing window focus must not leave movement keys stuck down.
    window.addEventListener("blur", () => this.keys.clear());
  }

  get isPointerLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.pressedThisFrame.clear();
    }
  }

  async requestPointerLock(): Promise<void> {
    if (this.isPointerLocked) return;
    try {
      await this.canvas.requestPointerLock();
    } catch {
      // Browser may reject rapid re-lock attempts; the user can click again.
    }
  }

  exitPointerLock(): void {
    if (this.isPointerLocked) document.exitPointerLock();
  }

  isDown(code: string): boolean {
    return this.enabled && this.keys.has(code);
  }

  wasPressed(code: string): boolean {
    return this.enabled && this.pressedThisFrame.has(code);
  }

  /** Returns accumulated mouse movement since last call and resets it. */
  consumeMouseDelta(): MouseDelta {
    const d = { ...this.mouseDelta };
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    return d;
  }

  /** Call at the end of each frame. */
  endFrame(): void {
    this.pressedThisFrame.clear();
  }
}
