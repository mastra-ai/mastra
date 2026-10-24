import { z } from 'zod';
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
const markdown = (value: string) =>
  value
    .replace(/[\\`*_{}\[\]()#+!|]/g, '\\$&')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
export function reportNotice(value: unknown, context: OperationContext) {
  const result = reportNoticeSchema.parse(value);
  const report = result.report;
  if (!result.available || !result.artifact)
    return `Draft unavailable. ${markdown(result.failure?.message ?? result.message)}${result.failure?.nextAction ? ' ' + markdown(result.failure.nextAction) : ''}`;
  const url = `/insurance/artifacts/${result.artifact.id}?caseId=${report.caseId}&threadId=${encodeURIComponent(context.threadId)}`;
  const pending = result.reviewStatus === undefined || result.reviewStatus === 'AWAITING_REVIEW';
  const lines = [
    `Draft available: version ${report.version} for ${markdown(report.identity.policyNumber ?? report.identity.insuredName ?? 'this case')}.`,
    `[Download draft report](${url})`,
    `Report ${report.id}. ${reportLabels.status[report.status]}.${pending ? ' Awaiting broker review.' : ''}`,
    `Snapshot checksum: ${result.snapshotHash ?? 'Read /report for the checksum'}. Case revision: ${result.caseRevision ?? 'Read /status'}.`,
    `${report.counts.checked} checked terms; ${report.counts.matches} matches; ${report.counts.discrepancies} discrepancies; ${report.counts.authorized} authorized changes; ${report.counts.unresolved} unresolved findings.`,
  ];
  const findings = report.comparisons.filter(f => f.classification !== 'MATCH');
  for (const finding of findings.slice(0, 5)) {
    lines.push(
      `${markdown(finding.label)} (finding ${finding.id}): ${reportLabels.classification[finding.classification]}. Expected: ${markdown(termValue(finding.baseline?.value))}. Issued or target: ${markdown(termValue(finding.actual?.value))}.`,
    );
    const evidence = finding.appliedChanges[0]?.evidence[0] ?? finding.evidence[0];
    if (evidence) {
      const source = report.sources.find(s => s.sourceId === evidence.sourceId)!;
      const locator =
        evidence.physicalPage !== null
          ? `physical page ${evidence.physicalPage}`
          : `record ${markdown(evidence.recordId!)}, field ${markdown(evidence.field!)}`;
      lines.push(
        `Evidence: ${markdown(source.displayName)}, ${locator} (source ${source.sourceId}).${evidence.excerpt.length <= 500 ? ' “' + markdown(evidence.excerpt) + '”' : ''}`,
      );
    }
  }
  if (findings.length > 5) lines.push('Read the draft for the remaining findings and exact evidence.');
  for (const artifact of result.finalization?.artifacts ?? [])
    lines.push(
      `[Download ${artifact.stage === 'reportOutput' ? 'final report' : 'editable correction draft'}](${artifact.url})`,
    );
  if (result.finalization?.failure)
    lines.push(
      `${markdown(result.finalization.failure.message)} ${markdown(result.finalization.failure.nextAction ?? '')}`,
    );
  lines.push(
    pending
      ? 'No approval or final report has been issued. Read /evidence for captured source text.'
      : markdown(result.message),
  );
  return lines.join('\n\n');
}
