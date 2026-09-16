import type { TriageResult } from "./support-case";

export const TRIAGE_REVIEW_CONFIDENCE_FLOOR = 0.5;

/** Human-review triage is a safety decision, not advice for the writer. */
export function triageEscalationReason(triage: TriageResult | undefined) {
  if (!triage) return undefined;
  const rationale = triage.rationale.trim();
  if (triage.requiresHumanReview)
    return `Triage requires human review${rationale ? `: ${rationale}` : "."}`;
  if (triage.confidence < TRIAGE_REVIEW_CONFIDENCE_FLOOR)
    return `Triage confidence ${triage.confidence.toFixed(2)} is below the ${TRIAGE_REVIEW_CONFIDENCE_FLOOR.toFixed(2)} escalation threshold${rationale ? `: ${rationale}` : "."}`;
  return undefined;
}

export function escalationReasonForDraft(options: {
  triage: TriageResult | undefined;
  missingEvidence: boolean;
  invalidCitation: boolean;
  staleEvidence: boolean;
  writerRequiresEscalation: boolean;
  writerReason: string | undefined;
}) {
  return (
    triageEscalationReason(options.triage) ??
    (options.missingEvidence
      ? "No published policy evidence was retrieved for this case."
      : undefined) ??
    (options.invalidCitation
      ? "The draft cited policy evidence that does not apply to this case."
      : undefined) ??
    (options.staleEvidence
      ? "The cited policy evidence is no longer active for this case."
      : undefined) ??
    (options.writerRequiresEscalation
      ? options.writerReason?.trim() || "The draft requested staff review."
      : undefined)
  );
}
