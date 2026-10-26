import { z } from 'zod';
import { IntakeError } from './operation-errors.js';
import type { ReportSnapshot } from './report-contracts.js';
import { reviewRequestSchema, type ReviewRequest } from './review-contracts.js';

const version = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const note = z.string().trim().min(1).max(4000);
export function parseNaturalReview(text: string) {
  const approval = /^Approve report version ([1-9]\d*)\.?$/i.exec(text.trim());
  if (approval) return { action: 'approve' as const, version: version.parse(approval[1]) };
  const revision = /^Revise report version ([1-9]\d*)(?: and add a short note on the first page)?:\s*([^]+)$/i.exec(
    text.trim(),
  );
  if (revision)
    return { action: 'revise' as const, version: version.parse(revision[1]), note: note.parse(revision[2]) };
  const confirmation = /^Confirm finding ([1-9]\d*) in report version ([1-9]\d*):\s*([^]+)$/i.exec(text.trim());
  if (confirmation)
    return {
      action: 'disposition' as const,
      finding: version.parse(confirmation[1]),
      version: version.parse(confirmation[2]),
      note: note.parse(confirmation[3]),
    };
  return null;
}
export const visibleFindings = (report: ReportSnapshot) =>
  report.comparisons.filter(finding => finding.classification !== 'MATCH');

/** Resolve only an explicit user instruction against one immutable report. */
export function naturalReviewRequest(
  text: string,
  report: ReportSnapshot,
  snapshotHash: string,
  expectedRevision: number,
  operationId: string,
): ReviewRequest {
  const command = parseNaturalReview(text);
  if (!command || command.version !== report.version)
    throw new IntakeError(
      'STALE_REVIEW',
      'That instruction does not identify the current report version awaiting review.',
      'Say “Show the report”, then name its exact version in your decision.',
    );
  const finding = command.action === 'disposition' ? report.comparisons[command.finding - 1] : undefined;
  if (command.action === 'disposition' && !finding)
    throw new IntakeError(
      'FINDING_CONTEXT',
      'That finding number is not in this report.',
      'Show the report and use one of its numbered findings.',
    );
  return reviewRequestSchema.parse({
    operationId,
    caseId: report.caseId,
    reportId: report.id,
    version: report.version,
    snapshotHash,
    expectedRevision,
    expectedState: 'AWAITING_REVIEW',
    action: command.action,
    dispositions: finding
      ? [
          {
            findingId: finding.id,
            disposition: 'confirmed',
            reason: command.action === 'disposition' ? command.note : null,
          },
        ]
      : [],
    revision: command.action === 'revise' ? { kind: 'presentation', note: command.note } : null,
  });
}

export function parseNamedClarification(text: string) {
  const lines = text
    .trim()
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const agreed =
    /^Check agreed terms using "([^"\n]+)" as the accepted (proposal|contract) and "([^"\n]+)" as the issued policy\.$/i.exec(
      lines[0] ?? '',
    );
  if (!agreed) return null;
  const fields = new Map<string, string>();
  const roles: { name: string; role: 'binder' | 'amendment' | 'reference' }[] = [];
  for (const line of lines.slice(1)) {
    const identity = /^(Policy number|Insured|Insurance product):\s*(.+)$/i.exec(line);
    const role = /^"([^"\n]+)" is (?:a|an) (binder|amendment|reference)\.$/i.exec(line);
    if (identity && !fields.has(identity[1]!.toLowerCase()))
      fields.set(identity[1]!.toLowerCase(), identity[2]!.trim());
    else if (role) roles.push({ name: role[1]!, role: role[2]!.toLowerCase() as 'binder' | 'amendment' | 'reference' });
    else
      throw new IntakeError(
        'CLARIFICATION_FORMAT',
        'The document roles or policy details are ambiguous.',
        'Use one identity line per field and one named-file role per additional document.',
      );
  }
  const identity = (field: string) => {
    const value = fields.get(field);
    if (!value)
      throw new IntakeError(
        'CLARIFICATION_FORMAT',
        'Policy details need your explicit confirmation.',
        'Include Policy number, Insured and Insurance product on separate lines. Use “unknown” for an unknown detail.',
      );
    return value.toLowerCase() === 'unknown' ? null : value;
  };
  return {
    reference: agreed[1]!,
    referenceRole: agreed[2]!.toLowerCase() as 'proposal' | 'contract',
    target: agreed[3]!,
    identity: {
      policyNumber: identity('policy number'),
      insuredName: identity('insured'),
      insuranceProduct: identity('insurance product'),
    },
    roles,
  };
}
