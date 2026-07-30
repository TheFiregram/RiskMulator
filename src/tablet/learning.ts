/**
 * Learning materials shown in the tablet's Learning app. Static, offline
 * content; `body` is trusted internal HTML rendered inside the tablet.
 */

export interface LearningArticle {
  id: string;
  title: string;
  blurb: string;
  body: string;
}

export const LEARNING_ARTICLES: readonly LearningArticle[] = [
  {
    id: "what_is_risk",
    title: "Hazard vs. Risk",
    blurb: "The two words everyone mixes up — and why the difference matters.",
    body: `
      <p>A <strong>hazard</strong> is anything with the potential to cause harm:
      a wet floor, a damaged cable, a heavy box on a high shelf.</p>
      <p>A <strong>risk</strong> is the chance that the hazard actually harms
      someone, combined with how bad that harm would be. The same hazard can
      carry very different risks: a wet floor in a locked storeroom is a low
      risk; the same spill in a busy corridor is a high one.</p>
      <p>Risk assessment is the discipline of separating the two: first find
      the hazard, then judge the risk it creates <em>in its context</em>, and
      only then decide what to do about it.</p>`,
  },
  {
    id: "five_steps",
    title: "The 5 Steps of Risk Assessment",
    blurb: "The standard process behind every inspection you run here.",
    body: `
      <p>Nearly every workplace safety framework uses the same five steps:</p>
      <ol>
        <li><strong>Identify the hazards</strong> — walk the workplace, look,
        photograph, talk to the people who work there.</li>
        <li><strong>Decide who might be harmed and how</strong> — workers,
        visitors, contractors; slips, shocks, strains.</li>
        <li><strong>Evaluate the risk</strong> — rate likelihood and severity,
        then decide whether existing controls are enough.</li>
        <li><strong>Record your findings</strong> — the hazard log and the
        inspection report you file on this tablet.</li>
        <li><strong>Review</strong> — workplaces change; assessments age.
        Inspect again on a schedule and after any incident.</li>
      </ol>
      <p>Your gameplay loop mirrors these steps deliberately: photograph
      (step 1), assess (step 3), log and report (step 4).</p>`,
  },
  {
    id: "matrix_guide",
    title: "Reading the 5×5 Risk Matrix",
    blurb: "How likelihood × severity turns judgement into a number.",
    body: `
      <p>The matrix multiplies <strong>likelihood</strong> (1 Rare → 5 Almost
      certain) by <strong>severity</strong> (1 Negligible → 5 Catastrophic).
      The product places the risk in a band:</p>
      <ul>
        <li><strong>1–4 Low</strong> — manage by routine procedures.</li>
        <li><strong>5–9 Moderate</strong> — act within a defined timescale.</li>
        <li><strong>10–15 High</strong> — act promptly; add interim controls.</li>
        <li><strong>16–25 Extreme</strong> — stop the activity until the risk
        is reduced.</li>
      </ul>
      <p>Two traps to avoid: rating severity for the <em>worst imaginable</em>
      outcome instead of the credible one, and letting a low likelihood excuse
      a catastrophic severity — a 2×5 still needs urgent attention.</p>`,
  },
  {
    id: "hierarchy_of_controls",
    title: "The Hierarchy of Controls",
    blurb: "Why a warning sign is the weakest answer, not the first one.",
    body: `
      <p>Controls are ranked from most to least effective:</p>
      <ol>
        <li><strong>Eliminate</strong> — remove the hazard entirely (clean up
        the spill, take the damaged cable out of service).</li>
        <li><strong>Substitute</strong> — replace with something safer.</li>
        <li><strong>Engineering controls</strong> — isolate people from the
        hazard (guards, barriers, better routing).</li>
        <li><strong>Administrative controls</strong> — procedures, training,
        signage.</li>
        <li><strong>PPE</strong> — the last line, protecting one person at a
        time.</li>
      </ol>
      <p>When the assessment form asks you to recommend a control, aim as high
      up this ladder as is proportionate. A cone next to a frayed cable is an
      administrative control on an electrical hazard — two rungs too low.</p>`,
  },
];
