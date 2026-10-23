import { z } from 'zod';
import { reportSnapshotSchema } from '../domain/reports.js';
import { reportLabels, termValue } from '../domain/report-presentation.js';
import { failureSchema } from '../domain/errors.js';
import type { OperationContext } from '../domain/contracts.js';
const reportNoticeSchema = z.object({
  report: reportSnapshotSchema,
  available: z.boolean(),
  message: z.string().min(1),
  artifact: z.object({ id: z.uuid() }).optional(),
  failure: failureSchema.optional(),
  reviewStatus: z.string().optional(),
  caseRevision: z.number().optional(),
  finalization: z
    .object({
      available: z.boolean(),
      artifacts: z.array(z.object({ stage: z.string(), url: z.string() })),
      failure: failureSchema.nullable().optional(),
    })
    .nullable()
    .optional(),
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
    `Report ${report.id}. ${reportLabels.status[report.status]}. ${pending ? 'Awaiting broker review' : markdown(result.message)}.`,
    `Snapshot checksum: ${result.report ? ((value as { snapshotHash?: string }).snapshotHash ?? 'Read /report for the checksum') : ''}. Case revision: ${result.caseRevision ?? 'Read /status'}.`,
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
