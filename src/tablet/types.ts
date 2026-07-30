import type * as THREE from "three";
import type { HazardClass, RiskBand } from "@/tablet/risk";

/** A control-measure choice offered for a hazard, with teaching feedback. */
export interface ControlOption {
  id: string;
  label: string;
  quality: "best" | "partial" | "poor";
  feedback: string;
}

/** The reference assessment for a hazard, used to grade the player. */
export interface HazardAnswer {
  classification: HazardClass;
  /** Classifications that earn partial credit (e.g. a cable is electrical first, trip second). */
  altClassifications?: HazardClass[];
  likelihood: number; // 1-5
  severity: number; // 1-5
  explanation: string;
  controls: ControlOption[];
}

/** A hazard placed in a scene that the player can photograph and assess. */
export interface HazardSpec {
  id: string;
  name: string;
  object: THREE.Object3D;
  answer: HazardAnswer;
}

export interface ProfileRecord {
  id: number;
  name: string;
  careerRank: string;
  totalPoints: number;
}

export type HazardEntryStatus = "draft" | "logged";

export interface HazardLogEntry {
  id: number;
  sceneId: string;
  hazardId: string;
  hazardName: string;
  status: HazardEntryStatus;
  classification: HazardClass | null;
  likelihood: number | null;
  severity: number | null;
  riskScore: number | null;
  controlMeasure: string | null;
  points: number;
  photoDataUrl: string | null;
  loggedAt: string;
}

/** One checklist line for a scene; done-ness derives from gameplay state. */
export type ChecklistItemSpec =
  | { id: string; label: string; kind: "photo" | "assess"; hazardId: string }
  | { id: string; label: string; kind: "flag"; flagId: string };

export interface ReportHazardLine {
  hazardName: string;
  classification: string;
  likelihood: number;
  severity: number;
  riskScore: number;
  controlMeasure: string;
  points: number;
}

export interface ReportSummary {
  sceneName: string;
  rankAtFiling: string;
  pointsEarned: number;
  hazards: ReportHazardLine[];
}

export interface ReportRecord {
  id: number;
  sceneId: string;
  title: string;
  summary: ReportSummary;
  filedAt: string;
}

export interface CertificateRecord {
  id: number;
  moduleId: string;
  title: string;
  issuedAt: string;
}

/** What the player submits from the tablet's assessment form. */
export interface AssessmentSubmission {
  classification: HazardClass;
  likelihood: number;
  severity: number;
  controlId: string;
}

export type Grade = "exact" | "close" | "miss";

export interface AssessmentResult {
  points: number;
  classificationGrade: Grade;
  likelihoodGrade: Grade;
  severityGrade: Grade;
  controlQuality: ControlOption["quality"];
  controlFeedback: string;
  riskScore: number;
  riskBand: RiskBand;
  correctRiskScore: number;
  correctRiskBand: RiskBand;
  explanation: string;
}
