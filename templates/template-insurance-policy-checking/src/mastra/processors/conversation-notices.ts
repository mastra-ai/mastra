import { safeFailure } from '../domain/operation-errors.js';
import type { CaseService } from '../services/case-service.js';
import { markdown } from './report-notice-formatter.js';

export const conversationHelp =
  'Attach textual PDFs, then identify the accepted reference, issued policy and policy details. Say “Show status”, “Compare the documents”, “Show the report”, or “Show page 1 of "filename.pdf"”.';
export function statusNotice(status: Awaited<ReturnType<CaseService['status']>>) {
  if (!status.case) return `No case is selected. Attach textual PDFs to begin.\n\n${conversationHelp}`;
  const record = status.case;
  const lines = [
    `Documents saved for ${markdown(record.identity.insuredName ?? 'this case')}${record.identity.policyNumber ? ` (policy ${markdown(record.identity.policyNumber)})` : ''}.`,
    ...(status.sources ?? []).map(
      source =>
        `• ${markdown(source.displayName)}${source.kind === 'pdf' ? `: ${source.pages.length} ${source.pages.length === 1 ? 'page' : 'pages'}` : ': captured records'}.`,
    ),
  ];
  if (!record.clarification)
    lines.push(
      'Before comparison, confirm the accepted reference and issued policy by filename, and provide the policy number, insured and insurance product. Use “unknown” for a detail you cannot establish.',
    );
  else
    lines.push(
      `Your document roles and policy details are saved.${record.clarification.acceptedBaseline ? ' Your accepted baseline is recorded.' : ''} Say “Compare the documents” when ready.`,
    );
  if (record.latestReportId)
    lines.push('A report is saved. Say “Show the report” for findings, review guidance and available PDF downloads.');
  return lines.join('\n\n');
}

/** Keep detailed machine failures in authoritative records, outside conversational notices. */
export function conversationFailure(error: unknown) {
  const failure = safeFailure(error);
  if (failure.code === 'INVALID_COMPARISON_EVIDENCE')
    return 'Some extracted evidence could not be verified against the saved documents. No new reviewable report was published. Show the source page and check the evidence before an explicit retry.';
  if (['STALE_REVIEW', 'REVIEW_MESSAGE', 'FINDING_CONTEXT', 'REVIEW_COMMAND'].includes(failure.code))
    return 'This review decision was not recorded. Name the exact current report version and, when confirming a finding, its displayed number and your reason. Say “Show the report” before trying again.';
  if (['SOURCE_NAME', 'CLARIFICATION_FORMAT'].includes(failure.code))
    return `${failure.message} ${failure.nextAction ?? ''}`;
  if (failure.code === 'EVIDENCE_LOCATOR')
    return 'That page is not available in the saved document. Show status and choose a physical page within that document.';
  // Internal field names and diagnostic codes are useful to API consumers, not brokers.
  const message = failure.message
    .replace(/\b[a-f0-9]{8}-[a-f0-9-]{27,}\b/gi, 'the saved item')
    .replace(/\b[a-f0-9]{64}\b/gi, 'the saved content')
    .replace(/\b(?:[a-z]+[A-Z]\w*|[A-Z]{2,}_[A-Z_]+)\b/g, 'the saved request');
  return `${message} Say “Show status” to check what is saved, or “Show the report” to inspect the current report before retrying.`;
}
