export interface CareerRank {
  id: string;
  label: string;
  minPoints: number;
}

/** Career ladder, ordered by minPoints ascending. */
export const CAREER_RANKS: readonly CareerRank[] = [
  { id: "risk_assessment_intern", label: "Risk Assessment Intern", minPoints: 0 },
  { id: "junior_risk_officer", label: "Junior Risk Officer", minPoints: 100 },
  { id: "risk_officer", label: "Risk Officer", minPoints: 250 },
  { id: "senior_risk_officer", label: "Senior Risk Officer", minPoints: 450 },
  { id: "risk_manager", label: "Risk Manager", minPoints: 700 },
];

export function rankForPoints(points: number): CareerRank {
  let current = CAREER_RANKS[0];
  for (const rank of CAREER_RANKS) {
    if (points >= rank.minPoints) current = rank;
  }
  return current;
}

export function rankLabel(id: string): string {
  return CAREER_RANKS.find((r) => r.id === id)?.label ?? id;
}

/** The next rank above the given points, or null at the top of the ladder. */
export function nextRank(points: number): CareerRank | null {
  return CAREER_RANKS.find((r) => r.minPoints > points) ?? null;
}
