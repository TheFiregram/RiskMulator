import {
  HAZARD_CLASSES,
  LIKELIHOOD_LABELS,
  RISK_BAND_LABELS,
  SEVERITY_LABELS,
  hazardClassLabel,
  riskBand,
  riskScore,
  type HazardClass,
} from "@/tablet/risk";
import { nextRank, rankLabel } from "@/tablet/career";
import type {
  AssessmentResult,
  AssessmentSubmission,
  Grade,
  HazardLogEntry,
  ProfileRecord,
} from "@/tablet/types";

export interface TabletObjective {
  label: string;
  done: boolean;
}

export interface TabletData {
  profile: ProfileRecord;
  entries: HazardLogEntry[];
  objectives: TabletObjective[];
}

export interface TabletCallbacks {
  onClose(): void;
  onOpenCamera(): void;
  getData(): TabletData;
  /** Control-measure choices for an entry's hazard (from the scene's hazard spec). */
  getControls(entry: HazardLogEntry): { id: string; label: string }[];
  submitAssessment(
    entryId: number,
    submission: AssessmentSubmission,
  ): Promise<AssessmentResult | null>;
}

type TabletView = "home" | "log" | "classify" | "feedback" | "matrix" | "objectives";

/**
 * DOM overlay for the corporate inspection tablet. Pure presentation: all
 * state changes go through TabletCallbacks (owned by TabletSystem).
 */
export class TabletUI {
  private overlay: HTMLElement;
  private callbacks: TabletCallbacks;
  private view: TabletView = "home";
  private classifyEntryId: number | null = null;
  private selection: Partial<AssessmentSubmission> = {};
  private lastResult: AssessmentResult | null = null;
  private submitting = false;

  constructor(uiRoot: HTMLElement, callbacks: TabletCallbacks) {
    this.callbacks = callbacks;
    this.overlay = document.createElement("div");
    this.overlay.id = "tablet-overlay";
    this.overlay.className = "tablet-overlay";
    uiRoot.appendChild(this.overlay);
    this.overlay.addEventListener("click", (e) => this.handleClick(e));
  }

  get isOpen(): boolean {
    return this.overlay.classList.contains("visible");
  }

  open(): void {
    this.view = "home";
    this.render();
    this.overlay.classList.add("visible");
  }

  close(): void {
    this.overlay.classList.remove("visible");
  }

  /** Re-renders the current view from fresh data (e.g. after async loads). */
  refresh(): void {
    if (this.isOpen) this.render();
  }

  /** Opens the tablet directly on a specific hazard entry's assessment form. */
  openClassify(entryId: number): void {
    this.classifyEntryId = entryId;
    this.selection = {};
    this.view = "classify";
    this.render();
    this.overlay.classList.add("visible");
  }

  // -------------------------------------------------------------------------

  private handleClick(e: MouseEvent): void {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!target) return;
    const action = target.dataset.action!;

    switch (action) {
      case "close":
        this.callbacks.onClose();
        break;
      case "home":
        this.view = "home";
        this.render();
        break;
      case "open-camera":
        this.callbacks.onOpenCamera();
        break;
      case "open-log":
        this.view = "log";
        this.render();
        break;
      case "open-matrix":
        this.view = "matrix";
        this.render();
        break;
      case "open-objectives":
        this.view = "objectives";
        this.render();
        break;
      case "classify": {
        this.classifyEntryId = Number(target.dataset.entry);
        this.selection = {};
        this.view = "classify";
        this.render();
        break;
      }
      case "pick-class":
        this.selection.classification = target.dataset.value as HazardClass;
        this.render();
        break;
      case "pick-likelihood":
        this.selection.likelihood = Number(target.dataset.value);
        this.render();
        break;
      case "pick-severity":
        this.selection.severity = Number(target.dataset.value);
        this.render();
        break;
      case "pick-control":
        this.selection.controlId = target.dataset.value;
        this.render();
        break;
      case "submit-assessment":
        void this.submit();
        break;
    }
  }

  private async submit(): Promise<void> {
    const { classification, likelihood, severity, controlId } = this.selection;
    if (
      this.submitting ||
      this.classifyEntryId === null ||
      !classification ||
      !likelihood ||
      !severity ||
      !controlId
    ) {
      return;
    }
    this.submitting = true;
    try {
      const result = await this.callbacks.submitAssessment(this.classifyEntryId, {
        classification,
        likelihood,
        severity,
        controlId,
      });
      if (result) {
        this.lastResult = result;
        this.view = "feedback";
        this.render();
      }
    } finally {
      this.submitting = false;
    }
  }

  // ------------------------------------------------------------- rendering --

  private render(): void {
    const data = this.callbacks.getData();
    let body: string;
    switch (this.view) {
      case "home":
        body = this.renderHome(data);
        break;
      case "log":
        body = this.renderLog(data);
        break;
      case "classify":
        body = this.renderClassify(data);
        break;
      case "feedback":
        body = this.renderFeedback();
        break;
      case "matrix":
        body = this.renderMatrix();
        break;
      case "objectives":
        body = this.renderObjectives(data);
        break;
    }

    this.overlay.innerHTML = `
      <div class="tablet-device">
        <div class="tablet-screen">
          <header class="tablet-status">
            <span class="tablet-brand">RiskCorp Field Tablet</span>
            <span class="tablet-profile">${rankLabel(data.profile.careerRank)} &bull; ${data.profile.totalPoints} pts</span>
          </header>
          <div class="tablet-body">${body}</div>
        </div>
        <button class="tablet-close" data-action="close" title="Close tablet (Tab)">&times;</button>
      </div>
    `;
  }

  private backBar(title: string): string {
    return `
      <div class="tablet-nav">
        <button class="tablet-back" data-action="home">&larr; Home</button>
        <h2>${title}</h2>
      </div>
    `;
  }

  private renderHome(data: TabletData): string {
    const drafts = data.entries.filter((e) => e.status === "draft").length;
    const draftBadge = drafts > 0 ? `<span class="tile-badge">${drafts}</span>` : "";
    const app = (action: string, icon: string, label: string, badge = "") => `
      <button class="tablet-tile" data-action="${action}">
        <span class="tile-icon">${icon}</span>
        <span class="tile-label">${label}</span>${badge}
      </button>
    `;
    const stub = (icon: string, label: string) => `
      <div class="tablet-tile tablet-tile-disabled" title="Coming in a later sprint">
        <span class="tile-icon">${icon}</span>
        <span class="tile-label">${label}</span>
        <span class="tile-soon">Soon</span>
      </div>
    `;
    return `
      <div class="tablet-grid">
        ${app("open-camera", "&#128247;", "Camera")}
        ${app("open-log", "&#128203;", "Hazard Log", draftBadge)}
        ${app("open-objectives", "&#127919;", "Objectives")}
        ${app("open-matrix", "&#9638;", "Risk Matrix")}
        ${stub("&#9745;", "Checklist")}
        ${stub("&#128196;", "Reports")}
        ${stub("&#128218;", "Learning")}
        ${stub("&#127891;", "Certificates")}
      </div>
    `;
  }

  private renderLog(data: TabletData): string {
    if (data.entries.length === 0) {
      return `
        ${this.backBar("Hazard Log")}
        <p class="tablet-empty">No hazards logged yet. Open the Camera and photograph anything that could cause harm.</p>
      `;
    }
    const rows = data.entries
      .map((e) => {
        const photo = e.photoDataUrl
          ? `<img class="log-thumb" src="${e.photoDataUrl}" alt="" />`
          : `<div class="log-thumb log-thumb-empty"></div>`;
        const detail =
          e.status === "draft"
            ? `<span class="chip chip-draft">Unclassified</span>
               <button class="btn btn-primary btn-small" data-action="classify" data-entry="${e.id}">Assess</button>`
            : `<span class="chip chip-band-${riskBand(e.riskScore ?? 0)}">
                 ${RISK_BAND_LABELS[riskBand(e.riskScore ?? 0)]} &bull; ${e.riskScore}
               </span>
               <span class="log-class">${e.classification ? hazardClassLabel(e.classification) : ""}</span>`;
        return `
          <div class="log-row">
            ${photo}
            <div class="log-info">
              <span class="log-name">${e.hazardName}</span>
              <div class="log-detail">${detail}</div>
            </div>
            <span class="log-points">+${e.points}</span>
          </div>
        `;
      })
      .join("");
    return `${this.backBar("Hazard Log")}<div class="log-list">${rows}</div>`;
  }

  private renderClassify(data: TabletData): string {
    const entry = data.entries.find((e) => e.id === this.classifyEntryId);
    if (!entry) {
      return `${this.backBar("Assessment")}<p class="tablet-empty">Entry not found.</p>`;
    }
    const s = this.selection;
    const opt = (
      action: string,
      value: string | number,
      label: string,
      selected: boolean,
      sub?: string,
    ) => `
      <button class="opt ${selected ? "opt-selected" : ""}" data-action="${action}" data-value="${value}">
        <span>${label}</span>${sub ? `<small>${sub}</small>` : ""}
      </button>
    `;

    const classes = HAZARD_CLASSES.map((c) =>
      opt("pick-class", c.id, c.label, s.classification === c.id),
    ).join("");
    const likelihoods = LIKELIHOOD_LABELS.map((label, i) =>
      opt("pick-likelihood", i + 1, String(i + 1), s.likelihood === i + 1, label),
    ).join("");
    const severities = SEVERITY_LABELS.map((label, i) =>
      opt("pick-severity", i + 1, String(i + 1), s.severity === i + 1, label),
    ).join("");

    const controls = this.controlOptionsFor(entry);

    let riskPreview = `<span class="chip chip-draft">Select likelihood &times; severity</span>`;
    if (s.likelihood && s.severity) {
      const score = riskScore(s.likelihood, s.severity);
      const band = riskBand(score);
      riskPreview = `<span class="chip chip-band-${band}">Risk: ${score} &mdash; ${RISK_BAND_LABELS[band]}</span>`;
    }

    const complete = !!(s.classification && s.likelihood && s.severity && s.controlId);
    return `
      ${this.backBar("Assess Hazard")}
      <div class="classify-form">
        <div class="classify-head">
          ${entry.photoDataUrl ? `<img class="classify-photo" src="${entry.photoDataUrl}" alt="" />` : ""}
          <h3>${entry.hazardName}</h3>
        </div>
        <h4>1. Classify the hazard</h4>
        <div class="opt-grid opt-grid-classes">${classes}</div>
        <h4>2. Likelihood of harm</h4>
        <div class="opt-grid opt-grid-scale">${likelihoods}</div>
        <h4>3. Severity if it happens</h4>
        <div class="opt-grid opt-grid-scale">${severities}</div>
        <div class="risk-preview">${riskPreview}</div>
        <h4>4. Recommend a control measure</h4>
        <div class="opt-list">${controls}</div>
        <button class="btn btn-primary tablet-submit" data-action="submit-assessment" ${complete ? "" : "disabled"}>
          Log Assessment
        </button>
      </div>
    `;
  }

  private controlOptionsFor(entry: HazardLogEntry): string {
    return this.callbacks
      .getControls(entry)
      .map(
        (c) =>
          `<button class="opt opt-wide ${this.selection.controlId === c.id ? "opt-selected" : ""}"
           data-action="pick-control" data-value="${c.id}"><span>${c.label}</span></button>`,
      )
      .join("");
  }

  private renderFeedback(): string {
    const r = this.lastResult;
    if (!r) return this.renderHome(this.callbacks.getData());

    const gradeIcon = (g: Grade) => (g === "exact" ? "&#10004;" : g === "close" ? "&#8776;" : "&#10008;");
    const gradeClass = (g: Grade) => `grade-${g}`;
    const controlGrade: Grade =
      r.controlQuality === "best" ? "exact" : r.controlQuality === "partial" ? "close" : "miss";

    const rankAfter = nextRank(this.callbacks.getData().profile.totalPoints);
    const nextRankNote = rankAfter
      ? `<p class="feedback-next">Next promotion at ${rankAfter.minPoints} pts: ${rankAfter.label}</p>`
      : "";

    return `
      ${this.backBar("Assessment Result")}
      <div class="feedback">
        <div class="feedback-points">+${r.points} pts</div>
        <div class="feedback-row ${gradeClass(r.classificationGrade)}">
          <span>${gradeIcon(r.classificationGrade)} Classification</span>
        </div>
        <div class="feedback-row ${gradeClass(r.likelihoodGrade)}">
          <span>${gradeIcon(r.likelihoodGrade)} Likelihood</span>
        </div>
        <div class="feedback-row ${gradeClass(r.severityGrade)}">
          <span>${gradeIcon(r.severityGrade)} Severity</span>
        </div>
        <div class="feedback-row ${gradeClass(controlGrade)}">
          <span>${gradeIcon(controlGrade)} Control measure</span>
        </div>
        <div class="feedback-risk">
          <span class="chip chip-band-${r.riskBand}">Your rating: ${r.riskScore} &mdash; ${RISK_BAND_LABELS[r.riskBand]}</span>
          <span class="chip chip-band-${r.correctRiskBand}">Reference: ${r.correctRiskScore} &mdash; ${RISK_BAND_LABELS[r.correctRiskBand]}</span>
        </div>
        <p class="feedback-text"><strong>Control measure:</strong> ${r.controlFeedback}</p>
        <p class="feedback-text">${r.explanation}</p>
        ${nextRankNote}
        <button class="btn btn-primary tablet-submit" data-action="open-log">Back to Hazard Log</button>
      </div>
    `;
  }

  private renderMatrix(): string {
    let rows = "";
    for (let l = 5; l >= 1; l--) {
      let cells = `<th>${l} &mdash; ${LIKELIHOOD_LABELS[l - 1]}</th>`;
      for (let sv = 1; sv <= 5; sv++) {
        const score = riskScore(l, sv);
        cells += `<td class="matrix-cell matrix-${riskBand(score)}">${score}</td>`;
      }
      rows += `<tr>${cells}</tr>`;
    }
    const headers = SEVERITY_LABELS.map((label, i) => `<th>${i + 1}<small>${label}</small></th>`).join("");
    return `
      ${this.backBar("Risk Matrix")}
      <p class="tablet-note">Risk = Likelihood &times; Severity. Assess both on a 1&ndash;5 scale.</p>
      <table class="matrix">
        <tr><th class="matrix-corner">L &darr; &nbsp; S &rarr;</th>${headers}</tr>
        ${rows}
      </table>
      <div class="matrix-legend">
        <span class="chip chip-band-low">1&ndash;4 Low</span>
        <span class="chip chip-band-moderate">5&ndash;9 Moderate</span>
        <span class="chip chip-band-high">10&ndash;15 High</span>
        <span class="chip chip-band-extreme">16&ndash;25 Extreme</span>
      </div>
    `;
  }

  private renderObjectives(data: TabletData): string {
    const items = data.objectives
      .map(
        (o) => `
        <div class="objective ${o.done ? "objective-done" : ""}">
          <span class="objective-mark">${o.done ? "&#10004;" : "&#9675;"}</span>
          <span>${o.label}</span>
        </div>
      `,
      )
      .join("");
    return `${this.backBar("Objectives")}<div class="objective-list">${items}</div>`;
  }
}
