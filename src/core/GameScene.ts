import * as THREE from "three";
import type { Engine } from "./Engine";

export abstract class GameScene {
  readonly scene = new THREE.Scene();
  protected engine: Engine;

  constructor(engine: Engine) {
    this.engine = engine;
  }

  abstract readonly id: string;

  /** Load assets and build the scene graph. May be called with a progress callback. */
  abstract load(onProgress: (fraction: number) => void): Promise<void>;

  abstract update(dt: number): void;

  abstract get camera(): THREE.PerspectiveCamera;

  onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      }
    });
  }
}
