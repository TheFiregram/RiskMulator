# RiskMulator

An offline-first desktop training simulator that teaches workplace risk management through immersive gameplay instead of lectures or quizzes.

Players walk through 3D workplace environments, identify hazards, photograph and classify them, assess likelihood and severity, calculate risk scores, and recommend control measures — progressing through a career path from Risk Assessment Intern to Risk Manager.

## Status

**Sprint 1 — Training Academy preview.** Playable build with:

- Main menu, loading screen, settings (graphics quality, mouse sensitivity, FOV, invert Y)
- First-person character controller (WASD + sprint, mouse look, pointer lock)
- Training Academy white room with interactable objects (press E to inspect)
- Pause menu (Esc)
- Local save system (SQLite in the desktop app, localStorage in browser dev)
- Graphics quality presets with hardware auto-detection

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri 2](https://tauri.app) (Rust) |
| 3D rendering | [Three.js](https://threejs.org) |
| Language | TypeScript (strict) |
| Bundler | Vite |
| Persistence | SQLite via `tauri-plugin-sql` |
| Assets | Blender (glTF pipeline, upcoming) |

## Development

Prerequisites: Node.js 20+, Rust (stable), and the [Tauri system dependencies](https://tauri.app/start/prerequisites/) for your platform.

```bash
npm install

# Browser dev (fast iteration, localStorage save backend)
npm run dev            # http://localhost:1420

# Desktop app dev (full Tauri + SQLite)
npm run tauri dev

# Production desktop build (Windows: msi/nsis, macOS: dmg/app)
npm run tauri build

# Type-check + bundle frontend only
npm run build
```

## Project Structure

```
index.html              App shell (canvas + UI root)
src/
  main.ts               Game orchestrator: state machine (menu/loading/playing/paused)
  style.css             All UI styling
  core/
    Engine.ts           Renderer, game loop, resize
    GameScene.ts        Abstract scene (load/update/dispose lifecycle)
    GraphicsSettings.ts Quality presets (low/medium/high) + hardware detection
    InputManager.ts     Keyboard/mouse state, pointer lock
    types.ts            Shared types (GameSettings, Interactable, ...)
  player/
    PlayerController.ts First-person movement, wall/prop collision
    InteractionSystem.ts  Center-screen raycast, E-to-interact
  scenes/
    WhiteRoomScene.ts   Training Academy environment
  save/
    SaveManager.ts      SQLite (Tauri) or localStorage (browser) backend
  ui/
    UIManager.ts        Menu / loading / settings / pause / HUD screens
src-tauri/
  src/lib.rs            Tauri entry, SQL plugin + migrations
  migrations/           SQLite schema (profiles, settings, saves, hazard log, certificates)
  tauri.conf.json       Window, bundling, CSP
  capabilities/         Permission grants for the main window
```

## Architecture Notes

- **Offline-first:** no network calls anywhere. All data lives in a local SQLite database (`riskmulator.db` in the app data directory). Optional online features can be added later behind the `SaveManager` abstraction without touching gameplay code.
- **Scenes** extend `GameScene` and own their camera; the `Engine` runs whichever scene is active. New environments (Factory, Warehouse, Construction Site) are added as new scene classes.
- **Performance:** quality presets cap pixel ratio, toggle shadows, and size shadow maps. Auto-detection picks a sensible default on first run. Target: smooth on low-end laptops.
- **Database schema** already anticipates the gameplay loop: `hazard_log` (classification, likelihood, severity, risk score, controls, photo path), `save_slots`, `profiles` (career rank, points), and `certificates`.

## Roadmap

1. **Training Academy** — tutorial environment (current)
2. **Factory** — first real workplace
3. **Warehouse**
4. **Construction Site**

Upcoming systems: inspection tablet (camera, hazard log, risk matrix, reports, learning materials, certificates), scoring and career progression, Blender asset pipeline with glTF streaming.
