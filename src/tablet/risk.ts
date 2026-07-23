import type {
  AssessmentResult,
  AssessmentSubmission,
  Grade,
  HazardAnswer,
} from "@/tablet/types";

export type HazardClass =
  | "slip_trip_fall"
  | "electrical"
  | "fire"
  | "chemical"
  | "manual_handling"
  | "machinery"
  | "environmental"
  | "biological";

export const HAZARD_CLASSES: ReadonlyArray<{ id: HazardClass; label: string }> = [
  { id: "slip_trip_fall", label: "Slip / Trip / Fall" },
  { id: "electrical", label: "Electrical" },
  { id: "fire", label: "Fire" },
  { id: "chemical", label: "Chemical" },
  { id: "manual_handling", label: "Manual Handling" },
  { id: "machinery", label: "Machinery" },
  { id: "environmental", label: "Environmental" },
  { id: "biological", label: "Biological" },
];

export function hazardClassLabel(id: HazardClass): string {
  return HAZARD_CLASSES.find((c) => c.id === id)?.label ?? id;
}

/** Index with (value - 1); scales run 1-5. */
export const LIKELIHOOD_LABELS = [
  "Rare",
  "Unlikely",
  "Possible",
  "Likely",
  "Almost certain",
] as const;

export const SEVERITY_LABELS = [
  "Negligible",
  "Minor",
  "Moderate",
  "Major",
  "Catastrophic",
] as const;

export type RiskBand = "low" | "moderate" | "high" | "extreme";

export const RISK_BAND_LABELS: Record<RiskBand, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  extreme: "Extreme",
};

export function riskScore(likelihood: number, severity: number): number {
  return likelihood * severity;
}

export function riskBand(score: number): RiskBand {
  if (score <= 4) return "low";
  if (score <= 9) return "moderate";
  if (score <= 15) return "high";
  return "extreme";
}

// Points awarded per assessment step.
const POINTS = {
  classificationExact: 10,
  classificationClose: 5,
  scaleExact: 10,
  scaleClose: 5,
  controlBest: 20,
  controlPartial: 10,
} as const;

/** Points for photographing a not-yet-logged hazard. */
export const POINTS_HAZARD_FOUND = 10;

/** Maximum points a single assessment can award (excludes the photo bonus). */
export const POINTS_ASSESSMENT_MAX =
  POINTS.classificationExact + POINTS.scaleExact * 2 + POINTS.controlBest;

function gradeScale(correct: number, submitted: number): Grade {
  const diff = Math.abs(correct - submitted);
  if (diff === 0) return "exact";
  if (diff === 1) return "close";
  return "miss";
}

export function scoreAssessment(
  answer: HazardAnswer,
  submission: AssessmentSubmission,
): AssessmentResult {
  let classificationGrade: Grade = "miss";
  if (submission.classification === answer.classification) classificationGrade = "exact";
  else if (answer.altClassifications?.includes(submission.classification))
    classificationGrade = "close";

  const likelihoodGrade = gradeScale(answer.likelihood, submission.likelihood);
  const severityGrade = gradeScale(answer.severity, submission.severity);

  const control =
    answer.controls.find((c) => c.id === submission.controlId) ?? answer.controls[0];

  const gradePoints = (g: Grade, exact: number, close: number) =>
    g === "exact" ? exact : g === "close" ? close : 0;

  let points = 0;
  points += gradePoints(classificationGrade, POINTS.classificationExact, POINTS.classificationClose);
  points += gradePoints(likelihoodGrade, POINTS.scaleExact, POINTS.scaleClose);
  points += gradePoints(severityGrade, POINTS.scaleExact, POINTS.scaleClose);
  if (control.quality === "best") points += POINTS.controlBest;
  else if (control.quality === "partial") points += POINTS.controlPartial;

  const score = riskScore(submission.likelihood, submission.severity);
  const correctScore = riskScore(answer.likelihood, answer.severity);

  return {
    points,
    classificationGrade,
    likelihoodGrade,
    severityGrade,
    controlQuality: control.quality,
    controlFeedback: control.feedback,
    riskScore: score,
    riskBand: riskBand(score),
    correctRiskScore: correctScore,
    correctRiskBand: riskBand(correctScore),
    explanation: answer.explanation,
  };
}
