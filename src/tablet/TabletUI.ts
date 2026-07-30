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
import { CAREER_RANKS, nextRank, rankLabel } from "@/tablet/career";
import { LEARNING_ARTICLES } from "@/tablet/learning";
import type {
  AssessmentResult,
  AssessmentSubmission,
  CertificateRecord,
  Grade,
  HazardLogEntry,
  ProfileRecord,
  ReportRecord,
} from "@/tablet/types";

export interface TabletObjective {
  label: string;
  done: boolean;
}

export interface TabletData {
  profile: ProfileRecord;
  entries: HazardLogEntry[];
  objectives: TabletObjective[];
  checklist: { label: string; done: boolean }[];
  reports: ReportRecord[];
  certificates: CertificateRecord[];
  sceneName: string;
  moduleTitle: string;
  hazardTotal: number;
  canFileReport: boolean;
  reportFiled: boolean;
}

export interface TabletCallbacks {
  onClose(): void;
  onOpenCamera(): void;
  onOpenSettings(): void;
  /** Notified when a view opens (used for checklist flags like the matrix). */
  onViewOpened(view: TabletView): void;
  getData(): TabletData;
  /** Control-measure choices for an entry's hazard (from the scene's hazard spec). */
  getControls(entry: HazardLogEntry): { id: string; label: string }[];
  submitAssessment(
    entryId: number,
    submission: AssessmentSubmission,
  ): Promise<AssessmentResult | null>;
  /** Files the inspection report; resolves true when it was accepted. */
  fileReport(): Promise<boolean>;
}

export type TabletView =
  | "home"
  | "log"
  | "classify"
  | "feedback"
  | "matrix"
  | "objectives"
  | "checklist"
  | "learning"
  | "article"
  | "progress"
  | "reports"
  | "report"
  | "certificates"
  | "certificate";

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
  private articleId: string | null = null;
  private reportId: number | null = null;
  private certificateId: number | null = null;
  private filing = false;

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

    const goto = (view: TabletView) => {
      this.view = view;
      this.callbacks.onViewOpened(view);
      this.render();
    };

    switch (action) {
      case "close":
        this.callbacks.onClose();
        break;
      case "home":
        goto("home");
        break;
      case "open-camera":
        this.callbacks.onOpenCamera();
        break;
      case "open-settings":
        this.callbacks.onOpenSettings();
        break;
      case "open-log":
        goto("log");
        break;
      case "open-matrix":
        goto("matrix");
        break;
      case "open-objectives":
        goto("objectives");
        break;
      case "open-checklist":
        goto("checklist");
        break;
      case "open-learning":
        goto("learning");
        break;
      case "open-article":
        this.articleId = target.dataset.article ?? null;
        goto("article");
        break;
      case "open-progress":
        goto("progress");
        break;
      case "open-reports":
        goto("reports");
        break;
      case "open-report":
        this.reportId = Number(target.dataset.report);
        goto("report");
        break;
      case "file-report":
        void this.handleFileReport();
        break;
      case "open-certificates":
        goto("certificates");
        break;
      case "open-certificate":
        this.certificateId = Number(target.dataset.cert);
        goto("certificate");
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

  private async handleFileReport(): Promise<void> {
    if (this.filing) return;
    this.filing = true;
    try {
      const ok = await this.callbacks.fileReport();
      if (ok) {
        this.view = "reports";
        this.render();
      }
    } finally {
      this.filing = false;
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
      case "checklist":
        body = this.renderChecklist(data);
        break;
      case "learning":
        body = this.renderLearning();
        break;
      case "article":
        body = this.renderArticle();
        break;
      case "progress":
        body = this.renderProgress(data);
        break;
      case "reports":
        body = this.renderReports(data);
        break;
      case "report":
        body = this.renderReport(data);
        break;
      case "certificates":
        body = this.renderCertificates(data);
        break;
      case "certificate":
        body = this.renderCertificate(data);
        break;
    }

    const homeButton =
      this.view === "home"
        ? ""
        : `<button class="tablet-home" data-action="home" title="Home">&#8962;</button>`;

    this.overlay.innerHTML = `
      <div class="tablet-device">
        <div class="tablet-screen">
          <header class="tablet-status">
            <span class="tablet-status-left">
              ${homeButton}<span class="tablet-brand">RiskCorp Field Tablet</span>
            </span>
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
    const reportBadge = data.canFileReport ? `<span class="tile-badge">!</span>` : "";
    const app = (action: string, icon: string, label: string, badge = "") => `
      <button class="tablet-tile" data-action="${action}">
        <span class="tile-icon">${icon}</span>
        <span class="tile-label">${label}</span>${badge}
      </button>
    `;
    return `
      <div class="tablet-grid">
        ${app("open-camera", "&#128247;", "Camera")}
        ${app("open-log", "&#128203;", "Hazard Log", draftBadge)}
        ${app("open-objectives", "&#127919;", "Objectives")}
        ${app("open-checklist", "&#9745;", "Checklist")}
        ${app("open-matrix", "&#9638;", "Risk Matrix")}
        ${app("open-reports", "&#128196;", "Reports", reportBadge)}
        ${app("open-learning", "&#128218;", "Learning")}
        ${app("open-progress", "&#128200;", "Progress")}
        ${app("open-certificates", "&#127891;", "Certificates")}
        ${app("open-settings", "&#9881;", "Settings")}
      </div>
    `;
  }

  private renderChecklist(data: TabletData): string {
    const items = data.checklist
      .map(
        (c) => `
        <div class="objective ${c.done ? "objective-done" : ""}">
          <span class="objective-mark">${c.done ? "&#10004;" : "&#9675;"}</span>
          <span>${c.label}</span>
        </div>
      `,
      )
      .join("");
    const done = data.checklist.filter((c) => c.done).length;
    return `
      ${this.backBar("Inspection Checklist")}
      <p class="tablet-note">${data.sceneName} &mdash; ${done}/${data.checklist.length} complete. Items tick off automatically as you work.</p>
      <div class="objective-list">${items}</div>
    `;
  }

  private renderLearning(): string {
    const rows = LEARNING_ARTICLES.map(
      (a) => `
      <button class="learn-row" data-action="open-article" data-article="${a.id}">
        <span class="learn-title">${a.title}</span>
        <span class="learn-blurb">${a.blurb}</span>
      </button>
    `,
    ).join("");
    return `${this.backBar("Learning")}<div class="learn-list">${rows}</div>`;
  }

  private renderArticle(): string {
    const article = LEARNING_ARTICLES.find((a) => a.id === this.articleId);
    if (!article) return `${this.backBar("Learning")}<p class="tablet-empty">Article not found.</p>`;
    return `
      <div class="tablet-nav">
        <button class="tablet-back" data-action="open-learning">&larr; Learning</button>
        <h2>${article.title}</h2>
      </div>
      <div class="article-body">${article.body}</div>
    `;
  }

  private renderProgress(data: TabletData): string {
    const points = data.profile.totalPoints;
    const next = nextRank(points);
    const currentRank = rankLabel(data.profile.careerRank);
    let bar = "";
    if (next) {
      const prev = CAREER_RANKS.filter((r) => r.minPoints <= points).pop()!;
      const span = next.minPoints - prev.minPoints;
      const pct = Math.min(100, Math.round(((points - prev.minPoints) / span) * 100));
      bar = `
        <div class="progress-track"><div class="progress-fill" style="width: ${pct}%"></div></div>
        <p class="tablet-note">${next.minPoints - points} pts to ${next.label}</p>
      `;
    } else {
      bar = `<p class="tablet-note">Top of the career ladder.</p>`;
    }
    const assessed = data.entries.filter((e) => e.status === "logged");
    const quality =
      assessed.length > 0
        ? Math.round(
            (assessed.reduce((sum, e) => sum + Math.max(0, e.points - 10), 0) /
              (assessed.length * 50)) *
              100,
          )
        : null;
    const stat = (label: string, value: string) => `
      <div class="stat-row"><span>${label}</span><strong>${value}</strong></div>
    `;
    return `
      ${this.backBar("Progress")}
      <div class="progress-card">
        <div class="progress-rank">${currentRank}</div>
        <div class="progress-points">${points} pts</div>
        ${bar}
      </div>
      <h4 class="section-title">${data.sceneName}</h4>
      ${stat("Hazards photographed", `${data.entries.length}/${data.hazardTotal}`)}
      ${stat("Hazards assessed", `${assessed.length}/${data.hazardTotal}`)}
      ${quality !== null ? stat("Assessment quality", `${quality}%`) : ""}
      ${stat("Reports filed", String(data.reports.length))}
      ${stat("Certificates", String(data.certificates.length))}
    `;
  }

  private renderReports(data: TabletData): string {
    let action = "";
    if (data.reportFiled) {
      action = `<p class="tablet-note">Inspection report for ${data.sceneName} has been filed.</p>`;
    } else if (data.canFileReport) {
      action = `
        <p class="tablet-note">All hazards assessed. File your findings to complete the inspection.</p>
        <button class="btn btn-primary tablet-submit" data-action="file-report">File Inspection Report</button>
      `;
    } else {
      action = `<p class="tablet-note">Assess every hazard in the Hazard Log to unlock the inspection report.</p>`;
    }
    const rows = data.reports
      .map(
        (r) => `
        <button class="learn-row" data-action="open-report" data-report="${r.id}">
          <span class="learn-title">${r.title}</span>
          <span class="learn-blurb">${r.summary.hazards.length} hazards &bull; filed ${r.filedAt.slice(0, 10)}</span>
        </button>
      `,
      )
      .join("");
    return `
      ${this.backBar("Reports")}
      ${action}
      ${rows ? `<h4 class="section-title">Filed reports</h4><div class="learn-list">${rows}</div>` : ""}
    `;
  }

  private renderReport(data: TabletData): string {
    const report = data.reports.find((r) => r.id === this.reportId);
    if (!report) return `${this.backBar("Reports")}<p class="tablet-empty">Report not found.</p>`;
    const rows = report.summary.hazards
      .map(
        (h) => `
        <tr>
          <td>${h.hazardName}</td>
          <td>${hazardClassLabel(h.classification as HazardClass)}</td>
          <td class="report-num">${h.likelihood}&times;${h.severity}</td>
          <td><span class="chip chip-band-${riskBand(h.riskScore)}">${h.riskScore}</span></td>
        </tr>
        <tr class="report-control-row"><td colspan="4">&#8627; ${h.controlMeasure}</td></tr>
      `,
      )
      .join("");
    return `
      <div class="tablet-nav">
        <button class="tablet-back" data-action="open-reports">&larr; Reports</button>
        <h2>${report.title}</h2>
      </div>
      <p class="tablet-note">Filed ${report.filedAt.slice(0, 10)} by ${report.summary.rankAtFiling} &bull; ${report.summary.pointsEarned} pts earned</p>
      <table class="report-table">
        <tr><th>Hazard</th><th>Class</th><th>L&times;S</th><th>Risk</th></tr>
        ${rows}
      </table>
    `;
  }

  private renderCertificates(data: TabletData): string {
    if (data.certificates.length === 0) {
      return `
        ${this.backBar("Certificates")}
        <p class="tablet-empty">No certificates yet. Complete a training module — assess every hazard, then file the inspection report.</p>
      `;
    }
    const rows = data.certificates
      .map(
        (c) => `
        <button class="learn-row" data-action="open-certificate" data-cert="${c.id}">
          <span class="learn-title">&#127891; ${c.title}</span>
          <span class="learn-blurb">Issued ${c.issuedAt.slice(0, 10)}</span>
        </button>
      `,
      )
      .join("");
    return `${this.backBar("Certificates")}<div class="learn-list">${rows}</div>`;
  }

  private renderCertificate(data: TabletData): string {
    const cert = data.certificates.find((c) => c.id === this.certificateId);
    if (!cert)
      return `${this.backBar("Certificates")}<p class="tablet-empty">Certificate not found.</p>`;
    return `
      <div class="tablet-nav">
        <button class="tablet-back" data-action="open-certificates">&larr; Certificates</button>
        <h2>Certificate</h2>
      </div>
      <div class="certificate">
        <div class="certificate-seal">&#9888;</div>
        <div class="certificate-org">RiskCorp Training Academy</div>
        <div class="certificate-heading">Certificate of Completion</div>
        <div class="certificate-name">${data.profile.name}</div>
        <div class="certificate-course">has completed the module</div>
        <div class="certificate-module">${cert.title}</div>
        <div class="certificate-meta">
          Issued ${cert.issuedAt.slice(0, 10)} &bull; Rank: ${rankLabel(data.profile.careerRank)} &bull; No. ${String(cert.id).padStart(4, "0")}
        </div>
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
