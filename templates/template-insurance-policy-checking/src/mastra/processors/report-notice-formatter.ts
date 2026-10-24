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
    return `The draft is unavailable for review. Say “Show the report” after checking the saved documents and local publication.`;
  const url = `/insurance/artifacts/${result.artifact.id}?caseId=${report.caseId}&threadId=${encodeURIComponent(context.threadId)}`;
  const finalReady = finalReportAvailable(result);
  const pending = result.reviewStatus === undefined || result.reviewStatus === 'AWAITING_REVIEW';
  const lines = [
    result.reviewStatus === 'FINALIZED' && !finalReady
      ? `Your approval is saved. The final PDF for report version ${report.version} is unavailable.`
      : `${finalReady ? 'Your final report is ready' : 'Your draft is ready'}: version ${report.version} for ${markdown(report.identity.policyNumber ?? report.identity.insuredName ?? 'this case')}.`,
    `[Download draft report](${url})`,
    pending
      ? `${reportLabels.status[report.status]}. Awaiting broker review.`
      : result.reviewStatus === 'FINALIZED'
        ? 'Broker review completed.'
        : 'The saved broker decision applies to this report version.',
    `**Summary**\n${report.counts.checked} checked terms; ${report.counts.matches} matches; ${report.counts.discrepancies} discrepancies; ${report.counts.authorized} authorized changes; ${report.counts.unresolved} unresolved findings.`,
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
    lines.push(
      `Finding ${number}: ${markdown(finding.label)} — ${reportLabels.classification[finding.classification]}. Expected: ${markdown(termValue(finding.baseline?.value))}. Issued or target: ${markdown(termValue(finding.actual?.value))}.`,
    );
    const evidence = finding.appliedChanges[0]?.evidence[0] ?? finding.evidence[0];
    if (evidence) {
      const source = report.sources.find(s => s.sourceId === evidence.sourceId)!;
      const locator =
        evidence.physicalPage !== null ? `physical page ${evidence.physicalPage}` : 'captured source record';
      lines[lines.length - 1] +=
        ` Evidence: ${markdown(source.displayName)}, ${locator}.${evidence.excerpt.length <= 500 ? ' “' + markdown(evidence.excerpt) + '”' : ''}`;
    }
  }
  if (!compact && findings.length > notable.length)
    lines.push(`The PDF includes ${findings.length - notable.length} more findings and the complete evidence.`);
  for (const artifact of result.finalization?.artifacts ?? [])
    if (finalReady && artifact.stage === 'reportOutput') lines.push(`[Download final report](${artifact.url})`);
  if (result.finalization?.failure)
    lines.push(
      'Final publication is incomplete. The saved broker decision remains recorded. Show the report to check availability before retrying.',
    );
  lines.push(
    pending
      ? `Review this draft before deciding. Say “Confirm finding ${report.comparisons.findIndex(f => f.classification !== 'MATCH') + 1 || 1} in report version ${report.version}: your reason” to confirm a finding, “Revise report version ${report.version}: your note” to request a revision, or “Approve report version ${report.version}” to approve. Approval alone confirms no findings.`
      : result.reviewStatus === 'FINALIZED'
        ? finalReady
          ? 'The reviewed report is finalized. Any correction request remains a draft for manual review; nothing has been sent.'
          : 'Broker approval remains saved. Restore the matching saved files and database, then show the report again. No new approval is needed.'
        : result.reviewStatus === 'REVISION_REQUESTED'
          ? 'This version cannot be approved while its revision is pending.'
          : result.reviewStatus === 'APPROVED'
            ? 'Broker approval is saved. Final publication is incomplete.'
            : result.reviewStatus === 'REJECTED'
              ? 'The broker rejected this report. Its draft remains available.'
              : 'This historical draft has been superseded and cannot be approved.',
  );
  if (result.reviewStatus === 'REVISION_REQUESTED')
    lines.push('Say “Compare the documents” to prepare the revised report, then review its new version.');
  return lines.join('\n\n');
}
