import * as THREE from "three";
import type { InputManager } from "@/core/InputManager";
import type { GameSettings } from "@/core/types";

const EYE_HEIGHT = 1.7;
const WALK_SPEED = 3.5;
const SPRINT_SPEED = 6.0;
const PLAYER_RADIUS = 0.35;
const PITCH_LIMIT = Math.PI / 2 - 0.05;

export class PlayerController {
  readonly camera: THREE.PerspectiveCamera;

  private input: InputManager;
  private yaw = 0;
  private pitch = 0;
  private position = new THREE.Vector3(0, EYE_HEIGHT, 0);
  private colliders: THREE.Box3[] = [];
  private bounds: THREE.Box3 | null = null;
  private settings: GameSettings;

  constructor(input: InputManager, settings: GameSettings) {
    this.input = input;
    this.settings = settings;
    this.camera = new THREE.PerspectiveCamera(
      settings.fov,
      window.innerWidth / window.innerHeight,
      0.1,
      200,
    );
    this.camera.rotation.order = "YXZ";
    this.syncCamera();
  }

  applySettings(settings: GameSettings): void {
    this.settings = settings;
    this.camera.fov = settings.fov;
    this.camera.updateProjectionMatrix();
  }

  setSpawn(position: THREE.Vector3, yaw = 0): void {
    this.position.set(position.x, EYE_HEIGHT, position.z);
    this.yaw = yaw;
    this.pitch = 0;
    this.syncCamera();
  }

  /** Walkable area; the player is clamped inside it. */
  setBounds(bounds: THREE.Box3): void {
    this.bounds = bounds;
  }

  /** Solid obstacles the player cannot walk through. */
  setColliders(colliders: THREE.Box3[]): void {
    this.colliders = colliders;
  }

  update(dt: number): void {
    const look = this.input.consumeMouseDelta();
    const sens = 0.0022 * this.settings.mouseSensitivity;
    this.yaw -= look.x * sens;
    this.pitch -= look.y * sens * (this.settings.invertY ? -1 : 1);
    this.pitch = THREE.MathUtils.clamp(this.pitch, -PITCH_LIMIT, PITCH_LIMIT);

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);

    const move = new THREE.Vector3();
    if (this.input.isDown("KeyW")) move.add(forward);
    if (this.input.isDown("KeyS")) move.sub(forward);
    if (this.input.isDown("KeyD")) move.add(right);
    if (this.input.isDown("KeyA")) move.sub(right);

    if (move.lengthSq() > 0) {
      move.normalize();
      const speed = this.input.isDown("ShiftLeft") ? SPRINT_SPEED : WALK_SPEED;
      move.multiplyScalar(speed * dt);
      // Resolve each axis independently so the player slides along walls.
      this.tryMove(move.x, 0);
      this.tryMove(0, move.z);
    }

    this.syncCamera();
  }

  private tryMove(dx: number, dz: number): void {
    const next = this.position.clone();
    next.x += dx;
    next.z += dz;

    if (this.bounds) {
      next.x = THREE.MathUtils.clamp(
        next.x,
        this.bounds.min.x + PLAYER_RADIUS,
        this.bounds.max.x - PLAYER_RADIUS,
      );
      next.z = THREE.MathUtils.clamp(
        next.z,
        this.bounds.min.z + PLAYER_RADIUS,
        this.bounds.max.z - PLAYER_RADIUS,
      );
    }

    for (const box of this.colliders) {
      if (
        next.x + PLAYER_RADIUS > box.min.x &&
        next.x - PLAYER_RADIUS < box.max.x &&
        next.z + PLAYER_RADIUS > box.min.z &&
        next.z - PLAYER_RADIUS < box.max.z
      ) {
        return;
      }
    }

    this.position.copy(next);
  }

  private syncCamera(): void {
    this.camera.position.copy(this.position);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
