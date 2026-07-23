import * as THREE from "three";
import type { InputManager } from "@/core/InputManager";
import type { Interactable } from "@/core/types";

const INTERACT_RANGE = 3.0;

export class InteractionSystem {
  private raycaster = new THREE.Raycaster();
  private interactables: Interactable[] = [];
  private focused: Interactable | null = null;
  private input: InputManager;

  /** Fired when the focused interactable changes (null = nothing in range). */
  onFocusChange?: (interactable: Interactable | null) => void;

  constructor(input: InputManager) {
    this.input = input;
    this.raycaster.far = INTERACT_RANGE;
  }

  register(interactable: Interactable): void {
    this.interactables.push(interactable);
  }

  clear(): void {
    this.interactables = [];
    this.setFocused(null);
  }

  update(camera: THREE.Camera): void {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const objects = this.interactables.map((i) => i.object);
    const hits = this.raycaster.intersectObjects(objects, true);

    let found: Interactable | null = null;
    if (hits.length > 0) {
      let obj: THREE.Object3D | null = hits[0].object;
      while (obj && !found) {
        const root = obj;
        found = this.interactables.find((i) => i.object === root) ?? null;
        obj = obj.parent;
      }
    }
    this.setFocused(found);

    if (this.focused && this.input.wasPressed("KeyE")) {
      this.focused.onInteract();
    }
  }

  private setFocused(next: Interactable | null): void {
    if (next === this.focused) return;
    this.focused = next;
    this.onFocusChange?.(next);
  }
}
