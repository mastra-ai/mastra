import { workflowMastraScorers } from '../evals/workflow-scorers.js';

// The registered scorers require the same DB-backed population as eval:check.
// A bare triage result or absent authority cannot earn a quality score.
export const securityScorers = {
  severity: workflowMastraScorers.severity!,
  attribution: workflowMastraScorers.attribution!,
  runbookCompliance: workflowMastraScorers.compliance!,
  hallucination: workflowMastraScorers.hallucination!,
  containmentSafety: workflowMastraScorers.safety!,
} as const;
