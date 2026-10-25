import { z } from 'zod';
import { visibleFindings } from '../domain/conversation-commands.js';
import type { OperationContext } from '../domain/case-contracts.js';
import { failureSchema } from '../domain/operation-errors.js';
import { reportSnapshotSchema } from '../domain/report-contracts.js';
import { reportLabels, termValue } from '../domain/report-presentation.js';
const reportNoticeSchema = z.object({
  report: reportSnapshotSchema.describe('Immutable report snapshot to display in the processor notice.'),
  snapshotHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional()
    .describe('SHA-256 checksum of the exact displayed report snapshot.'),
  available: z
    .boolean()
    .describe('Whether all required artifact bytes passed durable retrieval and checksum verification.'),
  message: z.string().min(1).describe('Safe user-facing explanation without private provider errors.'),
  artifact: z
    .object({ id: z.uuid().describe('Stable identifier of this persisted entity.') })
    .optional()
    .describe('Verified output artifact descriptor, or null before publication.'),
  failure: failureSchema.optional().describe('Safe recorded failure; null or absent when no failure is recorded.'),
  reviewStatus: z
    .string()
    .optional()
    .describe('Persisted broker review state, separate from the analytical conclusion.'),
  caseRevision: z.number().optional().describe('Current case revision to use in a subsequent explicit operation.'),
  finalization: z
    .object({
      available: z
        .boolean()
        .describe('Whether all required artifact bytes passed durable retrieval and checksum verification.'),
      artifacts: z
        .array(
          z.object({
            stage: z.string().describe('Provider output stage: draft, approved report or proposed correction.'),
            url: z.string().describe('Protected local download URL bound to the selected case and conversation.'),
          }),
        )
        .describe('Reserved or verified artifacts belonging to this finalization.'),
      failure: failureSchema
        .nullable()
        .optional()
        .describe('Safe recorded failure; null or absent when no failure is recorded.'),
    })
    .nullable()
    .optional()
    .describe('Durable approved publication and its artifact availability.'),
});
export const markdown = (value: string) =>
  value
    .replace(/[\\`*_{}\[\]()#+!|]/g, '\\$&')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
export function finalReportAvailable(value: unknown) {
  const result = reportNoticeSchema.parse(value);
  return (
    result.reviewStatus === 'FINALIZED' &&
    result.finalization?.available === true &&
    result.finalization.artifacts.some(artifact => artifact.stage === 'reportOutput')
  );
}
export function reportNotice(value: unknown, context: OperationContext, compact = false) {
  const result = reportNoticeSchema.parse(value);
  const report = result.report;
  if (!result.available || !result.artifact)
    return 'I could not open the saved draft. Check that the case database and report files are available, then say “Show the report” to try again.';
  const url = `/insurance/artifacts/${result.artifact.id}?caseId=${report.caseId}&threadId=${encodeURIComponent(context.threadId)}`;
  const finalReady = finalReportAvailable(result);
  const pending = result.reviewStatus === undefined || result.reviewStatus === 'AWAITING_REVIEW';
  const counted = (count: number, singular: string, plural = singular + 's') =>
    `${count === 0 ? 'no' : count} ${count === 1 ? singular : plural}`;
  const counts = report.counts;
  const lines = [
    result.reviewStatus === 'FINALIZED' && !finalReady
      ? `Your approval is saved, but I could not open the final PDF for report version ${report.version}.`
      : `${finalReady ? 'Your final report is ready' : 'Your draft is ready'} for ${markdown(report.identity.policyNumber ?? report.identity.insuredName ?? 'this case')} (version ${report.version}).`,
    `[Download draft report](${url})`,
    pending
      ? `${reportLabels.status[report.status]}. Please review the draft before making a decision.`
      : result.reviewStatus === 'FINALIZED'
        ? 'Broker review completed.'
        : 'Your broker decision is saved for this report version.',
    `**Summary**\nI checked ${counts.checked} ${counts.checked === 1 ? 'term' : 'terms'}. The report has ${counted(counts.matches, 'match', 'matches')}, ${counted(counts.discrepancies, 'discrepancy', 'discrepancies')}, ${counted(counts.authorized, 'authorized change')}, and ${counted(counts.unresolved, 'unresolved finding')}.`,
  ];
  const findings = visibleFindings(report);
  const notable = [...findings]
    .sort(
      (a, b) =>
        Number(b.classification === 'DISCREPANCY') * 2 +
        Number(Boolean(b.baseline && b.actual) && termValue(b.baseline?.value) !== termValue(b.actual?.value)) -
        (Number(a.classification === 'DISCREPANCY') * 2 +
          Number(Boolean(a.baseline && a.actual) && termValue(a.baseline?.value) !== termValue(a.actual?.value))),
    )
    .slice(0, 3);
  if (!compact && notable.length) lines.push('**Items to review**');
  for (const finding of compact ? [] : notable) {
    const number = report.comparisons.findIndex(candidate => candidate.id === finding.id) + 1;
    const baselineLabel = report.intent === 'agreed_terms_checking' ? 'Agreed terms' : 'Reference terms';
    const targetLabel =
      report.sources.find(source => source.sourceId === report.targetId)?.role === 'issued_policy'
        ? 'Issued policy'
        : 'Compared document';
    const terms = [
      `${finding.classification === 'AUTHORIZED_CHANGE' ? 'Original terms' : baselineLabel}: ${markdown(termValue(finding.baseline?.value))}.`,
      ...(finding.classification === 'AUTHORIZED_CHANGE'
        ? [`Approved terms: ${markdown(termValue(finding.effectiveValue))}.`]
        : []),
      `${targetLabel}: ${markdown(termValue(finding.actual?.value))}.`,
    ];
    lines.push(
      `**Finding ${number}: ${markdown(finding.label)}**\n${reportLabels.classification[finding.classification]}.\n\n${terms.map(term => '- ' + term).join('\n')}`,
    );
    const evidence = finding.appliedChanges[0]?.evidence[0] ?? finding.evidence[0];
    if (evidence) {
      const source = report.sources.find(s => s.sourceId === evidence.sourceId)!;
      const locator =
        evidence.physicalPage !== null ? `physical page ${evidence.physicalPage}` : 'captured source record';
      lines[lines.length - 1] +=
        `\n\nSource: ${markdown(source.displayName)}, ${locator}.${evidence.excerpt.length <= 500 ? ' “' + markdown(evidence.excerpt) + '”' : ''}`;
    }
  }
  if (!compact && findings.length > notable.length)
    lines.push(
      `The PDF includes ${counted(findings.length - notable.length, 'additional finding')} and the full supporting evidence.`,
    );
  for (const artifact of result.finalization?.artifacts ?? [])
    if (finalReady && artifact.stage === 'reportOutput') lines.push(`[Download final report](${artifact.url})`);
  if (result.finalization?.failure)
    lines.push(
      'The final files could not all be published. Your broker decision is saved. Say “Show the report” to check availability before trying again.',
    );
  const firstReviewFinding = report.comparisons.findIndex(finding => finding.classification !== 'MATCH') + 1;
  lines.push(
    pending
      ? `After reviewing the PDF, you can:\n\n${firstReviewFinding ? '- Confirm a finding: “Confirm finding ' + firstReviewFinding + ' in report version ' + report.version + ': your reason”.\n' : ''}- Request a revision: “Revise report version ${report.version}: your note”.\n- Approve this version: “Approve report version ${report.version}”.\n\nApproval does not confirm individual findings.`
      : result.reviewStatus === 'FINALIZED'
        ? finalReady
          ? 'The reviewed report is finalized. Any correction request remains a draft for manual review; nothing has been sent.'
          : 'Your approval is saved. Restore the matching case database and report files, then say “Show the report”. You do not need to approve again.'
        : result.reviewStatus === 'REVISION_REQUESTED'
          ? 'You requested a revision. This version cannot be approved until the revised report is ready.'
          : result.reviewStatus === 'APPROVED'
            ? 'Your approval is saved. The final files are not all available yet.'
            : result.reviewStatus === 'REJECTED'
              ? 'The broker rejected this report. Its draft remains available.'
              : 'This historical draft has been superseded and cannot be approved.',
  );
  if (result.reviewStatus === 'REVISION_REQUESTED')
    lines.push('Say “Compare the documents” to prepare the revised report, then review its new version.');
  return lines.join('\n\n');
}
