# RiskMulator — Engineering Guide

Offline-first desktop training simulator (Tauri 2 + Three.js + TypeScript + SQLite) that teaches workplace risk management through gameplay. Treat this as a long-term commercial product: production quality, no shortcuts, optimization from day one.

## Commands

```bash
npm run dev          # Vite dev server on :1420 (browser, localStorage saves)
npm run tauri dev    # Full desktop app (SQLite saves)
npm run build        # tsc --noEmit && vite build  — run before committing
npm run tauri build  # Production installers
cd src-tauri && cargo check   # Verify Rust side
```

## Architecture

- `src/main.ts` — `Game` class owns the state machine: `menu → loading → playing ⇄ paused`. All screen transitions and pointer-lock choreography live here.
- `src/core/Engine.ts` — WebGL renderer + RAF loop. Renders `engine.scene` (a `GameScene`), calls its `update(dt)`. dt is clamped to 0.1s.
- `src/core/GameScene.ts` — abstract base: `load(onProgress)`, `update(dt)`, `camera`, `dispose()`. Every environment (White Room, Factory, ...) is a subclass owning its own camera and gameplay wiring.
- `src/core/GraphicsSettings.ts` — quality presets (pixel ratio cap, shadows, shadow map size). `detectDefault()` picks a preset from hardware on first run.
- `src/player/PlayerController.ts` — first-person controller. Collision = XZ clamp against a bounds `Box3` + AABB list; axis-separated movement for wall sliding. Eye height 1.7m — keep interactable geometry spanning that height so the center-screen ray hits it.
- `src/player/InteractionSystem.ts` — raycast from screen center, 3m range. Register `Interactable`s ({object, prompt, onInteract}); raycast resolves child-mesh hits up to the registered root.
- `src/save/SaveManager.ts` — settings/save persistence behind a backend interface: SQLite (`tauri-plugin-sql`) when `__TAURI_INTERNALS__` exists, localStorage otherwise. Any new persisted data goes through this abstraction.
- `src/ui/UIManager.ts` — all DOM UI (menu/loading/settings/pause/HUD/viewfinder/toasts) rendered into `#ui-root` over the canvas. Screens toggled via `.visible` class.
- `src/tablet/` — the inspection tablet, core gameplay. `TabletSystem` owns state (profile, hazard-log entries, camera mode) and orchestrates capture → detect → draft → assess; `TabletUI` is pure presentation driven through `TabletCallbacks`; `risk.ts` is the domain model (classifications, 5×5 matrix, `scoreAssessment`); `career.ts` maps points → rank. Scenes expose a `hazards: HazardSpec[]` list (reference answer + control options per hazard); photo capture matches the framed hazard by distance (≤8m) + view angle (≤~26°) against that list. `Engine.captureFrame()` re-renders then downscales to a JPEG data URL.
- `src-tauri/migrations/*.sql` — schema versioned via `tauri-plugin-sql` migrations registered in `lib.rs`. Add new migrations as new files with incremented version numbers; never edit an applied migration.

## Conventions

- TypeScript strict; path alias `@/*` → `src/*` (defined in both tsconfig and vite.config).
- Offline-first is non-negotiable: no network calls, no CDN assets, no telemetry.
- Performance: target low-end laptops. New scenes must respect `GraphicsSettings` presets (shadows, map sizes). Prefer baked/simple lighting; keep draw calls low.
- Dispose GPU resources: `GameScene.dispose()` handles meshes; anything outside the scene graph must be disposed manually.
- Branching: `main` is stable; develop on feature branches.

## Testing

No test framework yet. Verify changes with `npm run build` (type check + bundle) and by exercising the game in a browser (`npm run dev`). The full flow: menu → Start Training → read the kiosk briefing → Tab opens the tablet → Camera app → photograph the spill and the damaged cable → assess both in the Hazard Log (classify, likelihood, severity, control) → points/rank update → Esc pauses → settings, points, and the hazard log persist across reload.
