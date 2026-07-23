import * as THREE from "three";
import type { QualityPreset } from "./types";

interface PresetConfig {
  pixelRatioCap: number;
  shadows: boolean;
  shadowMapSize: number;
  anisotropy: number;
}

const PRESETS: Record<QualityPreset, PresetConfig> = {
  low: { pixelRatioCap: 1, shadows: false, shadowMapSize: 512, anisotropy: 1 },
  medium: { pixelRatioCap: 1.5, shadows: true, shadowMapSize: 1024, anisotropy: 4 },
  high: { pixelRatioCap: 2, shadows: true, shadowMapSize: 2048, anisotropy: 8 },
};

export class GraphicsSettings {
  private renderer: THREE.WebGLRenderer;
  private preset: QualityPreset = "medium";
  private listeners = new Set<(preset: QualityPreset) => void>();

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
  }

  get current(): QualityPreset {
    return this.preset;
  }

  get config(): PresetConfig {
    return PRESETS[this.preset];
  }

  apply(preset: QualityPreset): void {
    this.preset = preset;
    const cfg = PRESETS[preset];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, cfg.pixelRatioCap));
    this.renderer.shadowMap.enabled = cfg.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    for (const fn of this.listeners) fn(preset);
  }

  onChange(fn: (preset: QualityPreset) => void): void {
    this.listeners.add(fn);
  }

  /** Rough hardware heuristic used the first time the game runs. */
  static detectDefault(): QualityPreset {
    const cores = navigator.hardwareConcurrency ?? 4;
    const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
    if (cores <= 2 || memory <= 2) return "low";
    if (cores >= 8 && memory >= 8) return "high";
    return "medium";
  }
}
