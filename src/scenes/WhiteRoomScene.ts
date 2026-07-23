import * as THREE from "three";
import { GameScene } from "@/core/GameScene";
import type { Engine } from "@/core/Engine";
import { PlayerController } from "@/player/PlayerController";
import { InteractionSystem } from "@/player/InteractionSystem";
import type { GameSettings, Interactable } from "@/core/types";

const ROOM_SIZE = 20;
const WALL_HEIGHT = 4;

export class WhiteRoomScene extends GameScene {
  readonly id = "white_room";

  readonly player: PlayerController;
  readonly interaction: InteractionSystem;

  /** Fired when an interactable wants to show a message to the player. */
  onShowMessage?: (title: string, body: string) => void;

  private colliders: THREE.Box3[] = [];

  constructor(engine: Engine, settings: GameSettings) {
    super(engine);
    this.player = new PlayerController(engine.input, settings);
    this.interaction = new InteractionSystem(engine.input);
  }

  get camera(): THREE.PerspectiveCamera {
    return this.player.camera;
  }

  async load(onProgress: (fraction: number) => void): Promise<void> {
    onProgress(0.1);
    this.buildRoom();
    onProgress(0.4);
    this.buildLighting();
    onProgress(0.6);
    this.buildProps();
    onProgress(0.9);

    const half = ROOM_SIZE / 2;
    this.player.setBounds(
      new THREE.Box3(
        new THREE.Vector3(-half, 0, -half),
        new THREE.Vector3(half, WALL_HEIGHT, half),
      ),
    );
    this.player.setColliders(this.colliders);
    this.player.setSpawn(new THREE.Vector3(0, 0, 6), 0);
    onProgress(1);
  }

  update(dt: number): void {
    this.player.update(dt);
    this.interaction.update(this.camera);
  }

  private buildRoom(): void {
    const half = ROOM_SIZE / 2;

    const floorMat = new THREE.MeshStandardMaterial({ color: 0xe8e8ec, roughness: 0.85 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(ROOM_SIZE, ROOM_SIZE, 0xc0c0c8, 0xd8d8de);
    grid.position.y = 0.001;
    this.scene.add(grid);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f7, roughness: 0.95 });
    const wallGeo = new THREE.PlaneGeometry(ROOM_SIZE, WALL_HEIGHT);
    const walls: Array<[number, number, number]> = [
      [0, -half, 0],
      [0, half, Math.PI],
      [-half, 0, Math.PI / 2],
      [half, 0, -Math.PI / 2],
    ];
    for (const [x, z, rotY] of walls) {
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(x, WALL_HEIGHT / 2, z);
      wall.rotation.y = rotY;
      wall.receiveShadow = true;
      this.scene.add(wall);
    }

    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = WALL_HEIGHT;
    this.scene.add(ceiling);
  }

  private buildLighting(): void {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xe4e4ea, 1.25));

    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(6, 8, 4);
    sun.castShadow = true;
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    const mapSize = this.engine.graphics.config.shadowMapSize;
    sun.shadow.mapSize.set(mapSize, mapSize);
    this.scene.add(sun);
  }

  private buildProps(): void {
    this.addInfoKiosk();
    this.addHazardCone();
    this.addSpillHazard();
  }

  private addInfoKiosk(): void {
    const kiosk = new THREE.Group();

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.3, 12),
      new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.5, metalness: 0.6 }),
    );
    post.position.y = 0.65;
    kiosk.add(post);

    // Panel spans eye level (~1.7m) so the interaction ray hits it head-on.
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.6, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.2 }),
    );
    panel.position.y = 1.6;
    panel.rotation.x = -0.2;
    kiosk.add(panel);

    kiosk.position.set(0, 0, -4);
    kiosk.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    this.scene.add(kiosk);
    this.addCollider(kiosk);

    this.registerInteractable({
      object: kiosk,
      prompt: "Read welcome briefing",
      onInteract: () =>
        this.onShowMessage?.(
          "Welcome to the Training Academy",
          "This is your risk assessment training environment. Walk around with WASD, look with the mouse, and press E to inspect objects. Future modules will teach you to photograph hazards, classify them, and calculate risk scores.",
        ),
    });
  }

  private addHazardCone(): void {
    const cone = new THREE.Group();

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.04, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xd9531e, roughness: 0.8 }),
    );
    base.position.y = 0.02;
    cone.add(base);

    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.55, 24),
      new THREE.MeshStandardMaterial({ color: 0xe8622a, roughness: 0.7 }),
    );
    body.position.y = 0.31;
    cone.add(body);

    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.125, 0.155, 0.12, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.5 }),
    );
    stripe.position.y = 0.32;
    cone.add(stripe);

    cone.position.set(-3, 0, -1.5);
    cone.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    this.scene.add(cone);

    this.registerInteractable({
      object: cone,
      prompt: "Inspect safety cone",
      onInteract: () =>
        this.onShowMessage?.(
          "Safety Cone",
          "Cones mark temporary hazards, but they are a control measure, not a fix. A cone reduces likelihood of an incident; it does not remove the hazard itself. Always ask: what is the underlying hazard, and can it be eliminated?",
        ),
    });
  }

  private addSpillHazard(): void {
    const spill = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 24),
      new THREE.MeshStandardMaterial({
        color: 0x4a7fb5,
        roughness: 0.1,
        metalness: 0.3,
        transparent: true,
        opacity: 0.7,
      }),
    );
    spill.rotation.x = -Math.PI / 2;
    spill.position.set(3.5, 0.005, -2);
    this.scene.add(spill);

    this.registerInteractable({
      object: spill,
      prompt: "Inspect wet floor",
      onInteract: () =>
        this.onShowMessage?.(
          "Hazard Identified: Wet Floor",
          "A liquid spill is a slip hazard. Likelihood: likely if left unmarked in a walkway. Severity: moderate (sprains, fractures). Controls: clean it up immediately, mark the area, and find the source of the leak. In later modules you will photograph and log hazards like this on your inspection tablet.",
        ),
    });
  }

  private registerInteractable(interactable: Interactable): void {
    this.interaction.register(interactable);
  }

  private addCollider(object: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(object);
    this.colliders.push(box);
  }
}
