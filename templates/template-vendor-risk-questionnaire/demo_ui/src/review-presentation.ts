import type { Detail } from './api';
import type { QuestionResult, Reason } from '../../src/mastra/contracts/answer';
import type { EvidenceLocator } from '../../src/mastra/contracts/evidence-locator';

export const statusLabels: Record<QuestionResult['status'], string> = {
  draft_eligible: 'Ready for review',
  review_required: 'Needs attention',
  security_review_required: 'Safety review required',
};

export const reasonMessages: Record<Reason, string> = {
  MISSING_EVIDENCE: 'No supporting evidence was found. Mark this answer as unknown or withhold it.',
  PARTIAL_EVIDENCE: 'The evidence covers only part of the question. Check what is missing before sharing an answer.',
  CONFLICTING_EVIDENCE: 'The sources disagree. Resolve the conflict before releasing an answer.',
  UNSUPPORTED_CLAIM: 'A claim is not supported by the cited evidence. Edit the answer or mark it as unknown.',
  INVALID_ATTRIBUTION:
    'A quotation does not match its cited source location. Editing the answer cannot repair the citation. Mark this answer as unknown or withhold it in this demo.',
  SENSITIVE_DISCLOSURE:
    'Check the sharing policy for each source. Sources that require permission need an explicit release; restricted sources cannot be shared.',
  UNSUPPORTED_COMMITMENT: 'The answer includes a commitment the evidence does not support. Remove it before sharing.',
  AMBIGUOUS_APPLICABILITY: 'The evidence may apply to a different product, environment or period. Check the scope.',
  LOW_CONFIDENCE: 'Confidence is below the required threshold. Check the answer against its evidence.',
  INCOMPATIBLE_RESPONSE: 'The answer does not fit the questionnaire’s allowed choices or length.',
  INCONSISTENT_ANSWERS: 'Related answers disagree. Check them together before sharing.',
  SOURCE_UNAVAILABLE: 'A required source is unavailable or is not approved for this use.',
  PROVIDER_FAILURE: 'The model provider could not complete this answer.',
  AUTHENTICATION_FAILURE: 'The model provider rejected the configured credentials.',
  MODEL_UNAVAILABLE: 'The configured model is unavailable.',
  STORAGE_FAILURE: 'The run could not read or save its data. Check the server log before retrying.',
  BUDGET_EXHAUSTED: 'The run reached its processing budget. Only unknown or withheld answers can be submitted.',
  TIME_LIMIT: 'The run reached its time limit. Only unknown or withheld answers can be submitted.',
  CALL_TIMEOUT: 'A model call timed out before the answer could be validated.',
  TOKEN_LIMIT: 'The run reached its token limit before this answer could be validated.',
  SECURITY_BLOCKED: 'A safety check blocked this content. Mark the answer as unknown or withhold it.',
  DETECTOR_FAILED: 'The safety check could not finish. This answer cannot be released.',
  INVALID_MODEL_OUTPUT: 'The generated answer did not meet the required format and could not be validated.',
};

// The demo edits answer text, not citation bindings. A text edit cannot fix attribution.
export function canEditAnswer(result: QuestionResult, documents: Detail['documents']) {
  return Boolean(
    result.draft &&
    result.draft.value !== 'unknown' &&
    result.status !== 'security_review_required' &&
    !result.reasons.includes('INVALID_ATTRIBUTION') &&
    result.draft.citations.every(citation => {
      const doc = documents.find(document => document.id === citation.documentId);
      return doc && doc.disclosure !== 'restricted';
    }),
  );
}

export function canReleaseDraft(result: QuestionResult, documents: Detail['documents']) {
  return canEditAnswer(result, documents) && result.reasons.every(reason => reason === 'SENSITIVE_DISCLOSURE');
}

export function citationLocation(locator: EvidenceLocator): string {
  switch (locator.kind) {
    case 'xlsx.cell':
      return `${locator.sheet} · Cell ${locator.cell}`;
    case 'xlsx.range':
      return `${locator.sheet} · Cells ${locator.start}–${locator.end}`;
    case 'pdf.block':
      return `Page ${locator.page} · Block ${locator.block + 1}`;
    case 'csv.cell':
      return `Row ${locator.row} · Column ${locator.column}`;
    case 'json.pointer':
      return `Field ${locator.pointer || '/'}`;
    case 'markdown.lines':
      return `Lines ${locator.startLine}–${locator.endLine}`;
  }
}
