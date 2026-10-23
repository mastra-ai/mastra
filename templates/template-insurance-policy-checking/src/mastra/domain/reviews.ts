import { z } from 'zod';
import { canonicalJson, hashBytes, type OperationContext } from './contracts.js';
import type { ReportSnapshot } from './reports.js';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const reason = z.string().trim().min(1).max(4000);
export const dispositionSchema = z
  .object({
    findingId: z.uuid(),
    disposition: z.enum(['confirmed', 'dismissed', 'requires_evidence']),
    reason: reason.nullable().default(null),
    severityOverride: z.enum(['High', 'Medium', 'Low']).nullable().default(null),
  })
  .strict()
  .superRefine((d, c) => {
    if ((d.disposition !== 'confirmed' || d.severityOverride) && !d.reason)
      c.addIssue({ code: 'custom', message: 'Dismissal, evidence requests and severity overrides require a reason.' });
  });
export const reviewRequestSchema = z
  .object({
    operationId: z.uuid(),
    caseId: z.uuid(),
    reportId: z.uuid(),
    version: z.number().int().positive(),
    snapshotHash: hash,
    expectedRevision: z.number().int().positive(),
    expectedState: z.literal('AWAITING_REVIEW'),
    action: z.enum(['approve', 'reject', 'revise', 'disposition']),
    dispositions: z.array(dispositionSchema).default([]),
    reason: reason.nullable().default(null),
    revision: z
      .object({ kind: z.enum(['presentation', 'evidence']), note: reason })
      .strict()
      .nullable()
      .default(null),
  })
  .strict()
  .superRefine((r, c) => {
    if (new Set(r.dispositions.map(d => d.findingId)).size !== r.dispositions.length)
      c.addIssue({ code: 'custom', message: 'Identify each finding only once.' });
    if ((r.action === 'revise') !== Boolean(r.revision))
      c.addIssue({ code: 'custom', message: 'Only a revision action carries a revision request.' });
    if (r.action === 'reject' && !r.reason) c.addIssue({ code: 'custom', message: 'Rejection requires a reason.' });
    if (r.action === 'disposition' && !r.dispositions.length)
      c.addIssue({ code: 'custom', message: 'A disposition action must identify findings.' });
    if (r.action !== 'revise' && r.dispositions.some(d => d.disposition === 'requires_evidence'))
      c.addIssue({ code: 'custom', message: 'Evidence requests require an explicit evidence revision action.' });
    if (r.dispositions.some(d => d.disposition === 'requires_evidence') && r.revision?.kind !== 'evidence')
      c.addIssue({ code: 'custom', message: 'Requested evidence must use an evidence revision.' });
  });
export type ReviewRequest = z.infer<typeof reviewRequestSchema>;
export const reviewEventSchema = z
  .object({
    id: z.uuid(),
    operationId: z.uuid(),
    caseId: z.uuid(),
    reportId: z.uuid(),
    reviewerId: z.string().min(1).max(200),
    threadId: z.string().min(1).max(200),
    messageId: z.string().min(1).max(300),
    messageHash: hash,
    at: z.iso.datetime(),
    action: z.enum(['approve', 'reject', 'revise', 'disposition']),
    disposition: dispositionSchema.nullable(),
    reason: reason.nullable(),
  })
  .strict();
export type ReviewEvent = z.infer<typeof reviewEventSchema>;
export const approvalSchema = z
  .object({
    schemaVersion: z.literal('approval-1'),
    id: z.uuid(),
    operationId: z.uuid(),
    caseId: z.uuid(),
    snapshotId: z.uuid(),
    snapshotHash: hash,
    version: z.number().int().positive(),
    workflowRunId: z.string().min(1),
    reviewerId: z.string().min(1).max(200),
    approvedAt: z.iso.datetime(),
    threadId: z.string().min(1).max(200),
    messageId: z.string().min(1).max(300),
    messageHash: hash,
    events: z.array(reviewEventSchema),
    eventSetHash: hash,
    providers: z.object({ reportOutput: z.string().min(1), correctionOutput: z.string().min(1) }).strict(),
  })
  .strict()
  .superRefine((a, c) => {
    if (
      hashBytes(canonicalJson(a.events)) !== a.eventSetHash ||
      new Set(a.events.map(e => e.id)).size !== a.events.length
    )
      c.addIssue({ code: 'custom', message: 'Approval must bind an exact unique immutable review event set.' });
    if (a.events.some(e => e.caseId !== a.caseId || e.threadId !== a.threadId || e.reviewerId !== a.reviewerId))
      c.addIssue({ code: 'custom', message: 'Approval events must belong to its trusted context.' });
  });
export type Approval = z.infer<typeof approvalSchema>;
export type ReviewDecision = (
  context: OperationContext,
  input: unknown,
  origin: { messageId: string; text: string },
) => Promise<unknown>;
export function latestDispositions(approval: Pick<Approval, 'events'>) {
  const saved = new Map<string, ReviewEvent>();
  for (const event of approval.events) if (event.disposition) saved.set(event.disposition.findingId, event);
  return saved;
}
export function actionableFindings(snapshot: ReportSnapshot, approval: Approval) {
  const dispositions = latestDispositions(approval);
  return snapshot.comparisons.filter(
    f =>
      snapshot.intent === 'agreed_terms_checking' &&
      f.classification === 'DISCREPANCY' &&
      dispositions.get(f.id)?.disposition?.disposition === 'confirmed' &&
      f.action.trim() &&
      f.evidence.length > 0 &&
      f.searched.length >= 2 &&
      f.searched.every(s => s.complete) &&
      !f.uncertainty.length,
  );
}
export const dispositionLabels = {
  confirmed: 'Confirmed by the broker',
  dismissed: 'Dismissed by the broker',
  requires_evidence: 'Additional evidence requested',
} as const;
