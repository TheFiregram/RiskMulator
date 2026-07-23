import * as THREE from "three";
import { GameScene } from "@/core/GameScene";
import type { Engine } from "@/core/Engine";
import { PlayerController } from "@/player/PlayerController";
import { InteractionSystem } from "@/player/InteractionSystem";
import type { GameSettings, Interactable } from "@/core/types";
import type { HazardSpec } from "@/tablet/types";

const ROOM_SIZE = 20;
const WALL_HEIGHT = 4;

export class WhiteRoomScene extends GameScene {
  readonly id = "white_room";

  readonly player: PlayerController;
  readonly interaction: InteractionSystem;

  /** Fired when an interactable wants to show a message to the player. */
  onShowMessage?: (title: string, body: string) => void;

  /** Hazards the player can photograph and assess on the tablet. */
  readonly hazards: HazardSpec[] = [];

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
    this.addCableHazard();
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
          "This room contains workplace hazards. Press Tab to open your inspection tablet, use the Camera to photograph anything that could cause harm, then assess each find in the Hazard Log: classify it, rate likelihood and severity, and recommend a control measure. Check Objectives on the tablet to track your progress.",
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
          "Liquid Spill",
          "An unmarked liquid spill in a walkway. This looks like something worth recording: photograph it with your tablet camera (Tab → Camera), then assess it in the Hazard Log.",
        ),
    });

    this.hazards.push({
      id: "wet_floor",
      name: "Wet floor spill",
      object: spill,
      answer: {
        classification: "slip_trip_fall",
        likelihood: 4,
        severity: 3,
        explanation:
          "An unmarked spill in a walkway is a slip hazard: harm is likely because everyone crossing the room walks through it, and severity is moderate — slips cause sprains and fractures. The best response removes the hazard rather than just warning about it: clean up the spill, sign the area while it dries, and find the source so it does not recur.",
        controls: [
          {
            id: "ignore",
            label: "No action — it will dry on its own",
            quality: "poor",
            feedback:
              "Leaving a spill in a walkway keeps the risk unchanged for as long as it takes to dry. Doing nothing is only acceptable when risk is already trivial.",
          },
          {
            id: "sign_only",
            label: "Place a wet floor sign and move on",
            quality: "partial",
            feedback:
              "Signage lowers the likelihood but the hazard is still there — someone distracted can still slip. Warning is a weak control; prefer removing the hazard.",
          },
          {
            id: "clean_sign_source",
            label: "Clean it up, sign the area, and find the source",
            quality: "best",
            feedback:
              "Correct: this eliminates the hazard, protects people while the floor dries, and prevents recurrence. Elimination beats warning every time.",
          },
          {
            id: "close_room",
            label: "Evacuate and close the room until inspected",
            quality: "poor",
            feedback:
              "Disproportionate: controls should match the scale of the risk. Shutting the room down for a small spill wastes resources and erodes trust in safety calls.",
          },
        ],
      },
    });
  }

  private addCableHazard(): void {
    const cableGroup = new THREE.Group();

    // Extension cable snaking across the walkway with a damaged, taped joint.
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-9.8, 0.02, -5.5),
      new THREE.Vector3(-7.5, 0.02, -4.6),
      new THREE.Vector3(-5.2, 0.02, -5.0),
      new THREE.Vector3(-3.0, 0.02, -4.0),
      new THREE.Vector3(-1.6, 0.02, -4.2),
    ]);
    const cable = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 40, 0.022, 6),
      new THREE.MeshStandardMaterial({ color: 0x22252c, roughness: 0.6 }),
    );
    cable.castShadow = true;
    cableGroup.add(cable);

    // Bright tape wrapped around the damaged section — the visual tell.
    const tape = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.12, 10),
      new THREE.MeshStandardMaterial({ color: 0xc23b3b, roughness: 0.8 }),
    );
    const tapePos = curve.getPoint(0.5);
    tape.position.set(tapePos.x, 0.025, tapePos.z);
    tape.rotation.z = Math.PI / 2;
    tape.rotation.y = 0.4;
    cableGroup.add(tape);

    const socket = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.08, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xf0f0f2, roughness: 0.4 }),
    );
    socket.position.set(-1.5, 0.04, -4.2);
    socket.castShadow = true;
    cableGroup.add(socket);

    this.scene.add(cableGroup);

    this.registerInteractable({
      object: cableGroup,
      prompt: "Inspect extension cable",
      onInteract: () =>
        this.onShowMessage?.(
          "Extension Cable",
          "A cable runs across the walkway and someone has taped over a damaged section. Worth recording: photograph it with your tablet camera (Tab → Camera), then assess it in the Hazard Log.",
        ),
    });

    this.hazards.push({
      id: "damaged_cable",
      name: "Damaged extension cable",
      object: cableGroup,
      answer: {
        classification: "electrical",
        altClassifications: ["slip_trip_fall"],
        likelihood: 3,
        severity: 4,
        explanation:
          "Tape over damaged insulation means the conductors may be exposed — an electrical hazard first, and a trip hazard second because it crosses the walkway. Electric shock makes severity major even though contact is only possible rather than likely. Damaged equipment must come out of service; tape is not a repair.",
        controls: [
          {
            id: "tape_again",
            label: "Add fresh tape over the damaged section",
            quality: "poor",
            feedback:
              "Tape is not an electrical repair — the insulation is still compromised. This hides the hazard instead of controlling it.",
          },
          {
            id: "reroute_only",
            label: "Re-route the cable along the wall, out of the walkway",
            quality: "partial",
            feedback:
              "That controls the trip risk, but the damaged insulation — the more severe hazard — is untouched. Always deal with the highest-severity part first.",
          },
          {
            id: "replace_reroute",
            label: "Take it out of service, replace it, route the new cable along the wall",
            quality: "best",
            feedback:
              "Correct: removal from service eliminates the electrical hazard, and routing the replacement along the wall prevents the trip hazard returning.",
          },
          {
            id: "cone_it",
            label: "Place a safety cone next to the cable",
            quality: "poor",
            feedback:
              "A cone warns about the trip risk but does nothing about damaged insulation — and people step over cones all day. Warning is the weakest control.",
          },
        ],
      },
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
