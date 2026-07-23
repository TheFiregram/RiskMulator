import type * as THREE from "three";

export type QualityPreset = "low" | "medium" | "high";

export interface GameSettings {
  quality: QualityPreset;
  mouseSensitivity: number;
  invertY: boolean;
  fov: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  quality: "medium",
  mouseSensitivity: 1.0,
  invertY: false,
  fov: 75,
};

export interface Interactable {
  object: THREE.Object3D;
  prompt: string;
  onInteract(): void;
}

export type GameState = "menu" | "loading" | "playing" | "paused";
