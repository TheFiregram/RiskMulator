import * as THREE from "three";
import type { Engine } from "@/core/Engine";
import type { SaveManager } from "@/save/SaveManager";
import { TabletUI, type TabletData, type TabletObjective } from "@/tablet/TabletUI";
import { POINTS_HAZARD_FOUND, POINTS_REPORT_FILED, scoreAssessment } from "@/tablet/risk";
import { rankForPoints, rankLabel } from "@/tablet/career";
import type {
  AssessmentResult,
  AssessmentSubmission,
  CertificateRecord,
  ChecklistItemSpec,
  HazardLogEntry,
  HazardSpec,
  ProfileRecord,
  ReportRecord,
} from "@/tablet/types";

/** How far away (m) and how far off-center a hazard can be and still count as photographed. */
const PHOTO_MAX_DISTANCE = 8;
const PHOTO_MAX_ANGLE = 0.45; // radians, ~26 degrees

/** Hooks the tablet needs from the game shell (pointer lock, HUD effects). */
export interface TabletHost {
  onOverlayOpened(): void;
  onOverlayClosed(): void;
  setCameraMode(on: boolean): void;
  flashCapture(): void;
  showToast(text: string): void;
  /** Open the game's settings screen; the tablet reopens when it closes. */
  openSettings(): void;
}

/** Everything the tablet needs to know about the loaded training scene. */
export interface TabletSceneInfo {
  sceneId: string;
  sceneName: string;
  moduleId: string;
  moduleTitle: string;
  hazards: HazardSpec[];
  checklist: ChecklistItemSpec[];
}

/**
 * Owns the inspection-tablet gameplay: photo capture, hazard detection,
 * the hazard log workflow, points, and career rank progression.
 */
export class TabletSystem {
  private ui: TabletUI;
  private save: SaveManager;
  private engine: Engine;
  private host: TabletHost;

  private profile: ProfileRecord | null = null;
  private entries: HazardLogEntry[] = [];
  private hazards: HazardSpec[] = [];
  private checklist: ChecklistItemSpec[] = [];
  private reports: ReportRecord[] = [];
  private certificates: CertificateRecord[] = [];
  private flags = new Set<string>();
  private sceneId = "";
  private sceneName = "";
  private moduleId = "";
  private moduleTitle = "";
  private cameraModeActive = false;
  private capturing = false;
  private filingReport = false;

  constructor(uiRoot: HTMLElement, save: SaveManager, engine: Engine, host: TabletHost) {
    this.save = save;
    this.engine = engine;
    this.host = host;
    this.ui = new TabletUI(uiRoot, {
      onClose: () => this.closeTablet(),
      onOpenCamera: () => this.enterCameraMode(),
      onOpenSettings: () => {
        this.ui.close();
        this.host.openSettings();
      },
      onViewOpened: (view) => {
        if (view === "matrix") void this.setFlag("matrix_viewed");
      },
      getData: () => this.data(),
      getControls: (entry) => this.controlsFor(entry),
      submitAssessment: (entryId, submission) => this.submitAssessment(entryId, submission),
      fileReport: () => this.fileReport(),
    });
  }

  get isOpen(): boolean {
    return this.ui.isOpen;
  }

  get isCameraMode(): boolean {
    return this.cameraModeActive;
  }

  async startSession(info: TabletSceneInfo): Promise<void> {
    this.sceneId = info.sceneId;
    this.sceneName = info.sceneName;
    this.moduleId = info.moduleId;
    this.moduleTitle = info.moduleTitle;
    this.hazards = info.hazards;
    this.checklist = info.checklist;
    try {
      this.profile = await this.save.ensureProfile();
      this.entries = await this.save.listHazardEntries(this.profile.id, info.sceneId);
      this.reports = await this.save.listReports(this.profile.id);
      this.certificates = await this.save.listCertificates(this.profile.id);
      const flags = await this.save.getValue(`flags:${info.sceneId}`);
      this.flags = new Set(flags ? (JSON.parse(flags) as string[]) : []);
    } catch (err) {
      console.error("Failed to load tablet session data:", err);
      this.profile = { id: 0, name: "Trainee", careerRank: "risk_assessment_intern", totalPoints: 0 };
      this.entries = [];
      this.reports = [];
      this.certificates = [];
      this.flags = new Set();
    }
  }

  endSession(): void {
    this.ui.close();
    this.cameraModeActive = false;
    this.host.setCameraMode(false);
    this.hazards = [];
    this.checklist = [];
    this.entries = [];
    this.flags = new Set();
    this.sceneId = "";
  }

  /** Records a named gameplay milestone (used by the checklist). */
  async setFlag(flag: string): Promise<void> {
    if (!this.sceneId || this.flags.has(flag)) return;
    this.flags.add(flag);
    await this.save.setValue(`flags:${this.sceneId}`, JSON.stringify([...this.flags]));
    this.ui.refresh();
  }

  toggleTablet(): void {
    if (this.ui.isOpen) this.closeTablet();
    else this.openTablet();
  }

  openTablet(): void {
    if (this.cameraModeActive) {
      this.cameraModeActive = false;
      this.host.setCameraMode(false);
    }
    this.host.onOverlayOpened();
    this.ui.open();
  }

  closeTablet(): void {
    this.ui.close();
    this.host.onOverlayClosed();
  }

  enterCameraMode(): void {
    this.ui.close();
    this.cameraModeActive = true;
    this.host.setCameraMode(true);
    this.host.onOverlayClosed();
  }

  exitCameraMode(): void {
    if (!this.cameraModeActive) return;
    this.cameraModeActive = false;
    this.host.setCameraMode(false);
  }

  async capturePhoto(camera: THREE.PerspectiveCamera): Promise<void> {
    if (!this.profile || this.capturing) return;
    const dataUrl = this.engine.captureFrame();
    if (!dataUrl) return;
    this.capturing = true;
    this.host.flashCapture();

    try {
      const hazard = this.detectHazard(camera);
      if (!hazard) {
        await this.save.addPhoto(this.profile.id, this.sceneId, null, dataUrl);
        this.host.showToast("Photo saved — no hazard in frame");
        return;
      }

      const existing = this.entries.find((e) => e.hazardId === hazard.id);
      if (existing) {
        await this.save.addPhoto(this.profile.id, this.sceneId, hazard.id, dataUrl);
        this.host.showToast(`${hazard.name} is already in your hazard log`);
        return;
      }

      const photoId = await this.save.addPhoto(this.profile.id, this.sceneId, hazard.id, dataUrl);
      await this.save.createHazardDraft(
        this.profile.id,
        this.sceneId,
        hazard.id,
        hazard.name,
        photoId,
        POINTS_HAZARD_FOUND,
      );
      await this.awardPoints(POINTS_HAZARD_FOUND);
      this.entries = await this.save.listHazardEntries(this.profile.id, this.sceneId);
      this.host.showToast(
        `New hazard captured: ${hazard.name} (+${POINTS_HAZARD_FOUND} pts) — assess it in the Hazard Log`,
      );
    } catch (err) {
      console.error("Failed to save photo:", err);
      this.host.showToast("Camera error — photo not saved");
    } finally {
      this.capturing = false;
    }
  }

  // -------------------------------------------------------------------------

  private detectHazard(camera: THREE.PerspectiveCamera): HazardSpec | null {
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const center = new THREE.Vector3();
    const box = new THREE.Box3();

    let best: HazardSpec | null = null;
    let bestAngle = Infinity;
    for (const hazard of this.hazards) {
      box.setFromObject(hazard.object);
      box.getCenter(center);
      const toHazard = center.sub(camera.position);
      if (toHazard.length() > PHOTO_MAX_DISTANCE) continue;
      const angle = toHazard.normalize().angleTo(forward);
      if (angle <= PHOTO_MAX_ANGLE && angle < bestAngle) {
        best = hazard;
        bestAngle = angle;
      }
    }
    return best;
  }

  private async awardPoints(delta: number): Promise<void> {
    if (!this.profile) return;
    const before = this.profile.careerRank;
    const newRank = rankForPoints(this.profile.totalPoints + delta);
    this.profile.totalPoints = await this.save.addPoints(this.profile.id, delta, newRank.id);
    this.profile.careerRank = newRank.id;
    if (newRank.id !== before) {
      this.host.showToast(`Promoted: ${rankLabel(newRank.id)}!`);
    }
  }

  private async submitAssessment(
    entryId: number,
    submission: AssessmentSubmission,
  ): Promise<AssessmentResult | null> {
    if (!this.profile) return null;
    const entry = this.entries.find((e) => e.id === entryId);
    const spec = entry && this.hazards.find((h) => h.id === entry.hazardId);
    if (!entry || !spec) return null;

    const result = scoreAssessment(spec.answer, submission);
    const controlLabel =
      spec.answer.controls.find((c) => c.id === submission.controlId)?.label ?? submission.controlId;

    try {
      await this.save.completeHazardEntry(entryId, {
        classification: submission.classification,
        likelihood: submission.likelihood,
        severity: submission.severity,
        riskScore: result.riskScore,
        controlMeasure: controlLabel,
        points: entry.points + result.points,
      });
      await this.awardPoints(result.points);
      this.entries = await this.save.listHazardEntries(this.profile.id, this.sceneId);
    } catch (err) {
      console.error("Failed to save assessment:", err);
      this.host.showToast("Save error — assessment not stored");
      return null;
    }
    return result;
  }

  private controlsFor(entry: HazardLogEntry): { id: string; label: string }[] {
    const spec = this.hazards.find((h) => h.id === entry.hazardId);
    return spec ? spec.answer.controls.map((c) => ({ id: c.id, label: c.label })) : [];
  }

  private get allAssessed(): boolean {
    return (
      this.hazards.length > 0 &&
      this.hazards.every((h) =>
        this.entries.some((e) => e.hazardId === h.id && e.status === "logged"),
      )
    );
  }

  private get reportFiledForScene(): boolean {
    return this.reports.some((r) => r.sceneId === this.sceneId);
  }

  private async fileReport(): Promise<boolean> {
    if (!this.profile || this.filingReport || !this.allAssessed || this.reportFiledForScene) {
      return false;
    }
    this.filingReport = true;
    try {
      const logged = this.entries.filter((e) => e.status === "logged");
      const summary = {
        sceneName: this.sceneName,
        rankAtFiling: rankLabel(this.profile.careerRank),
        pointsEarned: logged.reduce((sum, e) => sum + e.points, 0),
        hazards: logged.map((e) => ({
          hazardName: e.hazardName,
          classification: e.classification ?? "",
          likelihood: e.likelihood ?? 0,
          severity: e.severity ?? 0,
          riskScore: e.riskScore ?? 0,
          controlMeasure: e.controlMeasure ?? "",
          points: e.points,
        })),
      };
      await this.save.fileReport(
        this.profile.id,
        this.sceneId,
        `Inspection Report — ${this.sceneName}`,
        summary,
      );
      await this.awardPoints(POINTS_REPORT_FILED);
      this.reports = await this.save.listReports(this.profile.id);
      this.host.showToast(`Report filed (+${POINTS_REPORT_FILED} pts)`);

      const hasCertificate = this.certificates.some((c) => c.moduleId === this.moduleId);
      if (!hasCertificate && this.moduleId) {
        await this.save.awardCertificate(
          this.profile.id,
          this.moduleId,
          `${this.sceneName}: ${this.moduleTitle}`,
        );
        this.certificates = await this.save.listCertificates(this.profile.id);
        this.host.showToast("Certificate earned — see the Certificates app");
      }
      return true;
    } catch (err) {
      console.error("Failed to file report:", err);
      this.host.showToast("Save error — report not filed");
      return false;
    } finally {
      this.filingReport = false;
    }
  }

  private objectives(): TabletObjective[] {
    const total = this.hazards.length;
    const found = this.hazards.filter((h) =>
      this.entries.some((e) => e.hazardId === h.id),
    ).length;
    const assessed = this.hazards.filter((h) =>
      this.entries.some((e) => e.hazardId === h.id && e.status === "logged"),
    ).length;
    return [
      { label: `Find and photograph hazards (${found}/${total})`, done: found === total && total > 0 },
      { label: `Assess photographed hazards (${assessed}/${total})`, done: assessed === total && total > 0 },
    ];
  }

  private checklistState(): { label: string; done: boolean }[] {
    return this.checklist.map((item) => {
      let done = false;
      if (item.kind === "flag") done = this.flags.has(item.flagId);
      else if (item.kind === "photo")
        done = this.entries.some((e) => e.hazardId === item.hazardId);
      else done = this.entries.some((e) => e.hazardId === item.hazardId && e.status === "logged");
      return { label: item.label, done };
    });
  }

  private data(): TabletData {
    return {
      profile:
        this.profile ?? { id: 0, name: "Trainee", careerRank: "risk_assessment_intern", totalPoints: 0 },
      entries: this.entries,
      objectives: this.objectives(),
      checklist: this.checklistState(),
      reports: this.reports,
      certificates: this.certificates,
      sceneName: this.sceneName,
      moduleTitle: this.moduleTitle,
      hazardTotal: this.hazards.length,
      canFileReport: this.allAssessed && !this.reportFiledForScene,
      reportFiled: this.reportFiledForScene,
    };
  }

  /** Reopens the tablet after the settings screen closes. */
  reopenAfterSettings(): void {
    this.host.onOverlayOpened();
    this.ui.open();
  }
}
