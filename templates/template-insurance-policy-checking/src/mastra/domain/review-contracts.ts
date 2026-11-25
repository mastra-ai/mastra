import { z } from 'zod';
import { canonicalJson, hashBytes, type OperationContext } from './case-contracts.js';
import type { ReportSnapshot } from './report-contracts.js';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const reason = z.string().trim().min(1).max(4000);
export const dispositionSchema = z
  .object({
    findingId: z.uuid().describe('Finding identifier from the exact report version under review.'),
    disposition: z
      .enum(['confirmed', 'dismissed', 'requires_evidence'])
      .describe('Explicit broker decision on a finding, separate from its machine classification.'),
    reason: reason
      .nullable()
      .default(null)
      .describe('Broker rationale; required for rejection, dismissal, evidence requests and severity overrides.'),
    severityOverride: z
      .enum(['High', 'Medium', 'Low'])
      .nullable()
      .default(null)
      .describe('Explicit broker priority override; null preserves the machine priority.'),
  })
  .strict()
  .superRefine((d, c) => {
    if ((d.disposition !== 'confirmed' || d.severityOverride) && !d.reason)
      c.addIssue({ code: 'custom', message: 'Dismissal, evidence requests and severity overrides require a reason.' });
  });
export const reviewRequestSchema = z
  .object({
    operationId: z
      .uuid()
      .describe('UUID identifying one idempotent operation; changed input requires a new identifier.'),
    caseId: z.uuid().describe('Identifier of the case selected in this conversation.'),
    reportId: z.uuid().describe('Identifier of the exact immutable report version.'),
    version: z.number().int().positive().describe('Immutable version of this source or report.'),
    snapshotHash: hash.describe('SHA-256 checksum binding this request to the exact report snapshot.'),
    expectedRevision: z
      .number()
      .int()
      .positive()
      .describe('Latest case revision observed by the caller; rejects stale updates.'),
    expectedState: z
      .literal('AWAITING_REVIEW')
      .describe('Required case state before accepting this version-bound review.'),
    action: z
      .enum(['approve', 'reject', 'revise', 'disposition'])
      .describe('Explicit broker action: approve, reject, revise or record finding dispositions.'),
    dispositions: z
      .array(dispositionSchema)
      .default([])
      .describe('Broker decisions on uniquely identified findings; an empty array confirms none.'),
    reason: reason
      .nullable()
      .default(null)
      .describe('Broker rationale; required for rejection, dismissal, evidence requests and severity overrides.'),
    revision: z
      .object({
        kind: z
          .enum(['presentation', 'evidence'])
          .describe('Presentation-only revision reuses analysis; evidence revision requires a new bounded comparison.'),
        note: reason.describe('Broker instruction describing the requested revision.'),
      })
      .strict()
      .nullable()
      .default(null)
      .describe('Requested presentation or evidence revision; null for other actions.'),
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
    id: z.uuid().describe('Stable identifier of this persisted entity.'),
    operationId: z
      .uuid()
      .describe('UUID identifying one idempotent operation; changed input requires a new identifier.'),
    caseId: z.uuid().describe('Identifier of the case selected in this conversation.'),
    reportId: z.uuid().describe('Identifier of the exact immutable report version.'),
    reviewerId: z.string().min(1).max(200).describe('Trusted configured local operator who recorded the decision.'),
    threadId: z
      .string()
      .min(1)
      .max(200)
      .describe('Persistent conversation identifier used with the operator to scope access.'),
    messageId: z
      .string()
      .min(1)
      .max(300)
      .describe('Identifier of the original user message authorizing this decision.'),
    messageHash: hash.describe('SHA-256 checksum of the exact authorizing user message.'),
    at: z.iso.datetime().describe('UTC timestamp when the broker review event was recorded.'),
    action: z
      .enum(['approve', 'reject', 'revise', 'disposition'])
      .describe('Explicit broker action: approve, reject, revise or record finding dispositions.'),
    disposition: dispositionSchema
      .nullable()
      .describe('Explicit broker decision on a finding, separate from its machine classification.'),
    reason: reason
      .nullable()
      .describe('Broker rationale; required for rejection, dismissal, evidence requests and severity overrides.'),
  })
  .strict();
export type ReviewEvent = z.infer<typeof reviewEventSchema>;
export const approvalSchema = z
  .object({
    schemaVersion: z
      .literal('approval-1')
      .describe('Version of the persisted contract used to interpret this snapshot.'),
    id: z.uuid().describe('Stable identifier of this persisted entity.'),
    operationId: z
      .uuid()
      .describe('UUID identifying one idempotent operation; changed input requires a new identifier.'),
    caseId: z.uuid().describe('Identifier of the case selected in this conversation.'),
    snapshotId: z.uuid().describe('Identifier of the immutable report snapshot.'),
    snapshotHash: hash.describe('SHA-256 checksum binding this request to the exact report snapshot.'),
    version: z.number().int().positive().describe('Immutable version of this source or report.'),
    workflowRunId: z.string().min(1).describe('Native Mastra workflow run bound to this analysis or report.'),
    reviewerId: z.string().min(1).max(200).describe('Trusted configured local operator who recorded the decision.'),
    approvedAt: z.iso.datetime().describe('UTC timestamp of the persisted broker approval.'),
    threadId: z
      .string()
      .min(1)
      .max(200)
      .describe('Persistent conversation identifier used with the operator to scope access.'),
    messageId: z
      .string()
      .min(1)
      .max(300)
      .describe('Identifier of the original user message authorizing this decision.'),
    messageHash: hash.describe('SHA-256 checksum of the exact authorizing user message.'),
    events: z.array(reviewEventSchema).describe('Exact immutable review events frozen with the approval.'),
    eventSetHash: hash.describe('SHA-256 checksum of the complete frozen review event set.'),
    providers: z
      .object({
        reportOutput: z.string().min(1).describe('Provider selected to materialize the approved final report.'),
        correctionOutput: z
          .string()
          .min(1)
          .describe('Provider selected for an applicable proposed correction request.'),
      })
      .strict()
      .describe('Stable approved-output provider selections frozen with approval.'),
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
  origin: {
    /** Identifier of the original user message authorizing this decision. */
    messageId: string;

    /** Searchable text captured from this physical PDF page. */
    text: string;
  },
) => Promise<unknown>;
/** Select the last recorded broker disposition for each finding in event order. */
export function latestDispositions(approval: Pick<Approval, 'events'>) {
  const saved = new Map<string, ReviewEvent>();
  for (const event of approval.events) if (event.disposition) saved.set(event.disposition.findingId, event);
  return saved;
}
/** Select confirmed, fully evidenced discrepancies eligible for a proposed correction. */
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

export type ReviewReceipt = {
  /** UUID identifying one idempotent operation; changed input requires a new identifier. */
  operationId: string;

  /** Identifier of the case selected in this conversation. */
  caseId: string;

  /** Identifier of the exact immutable report version. */
  reportId: string;

  /** Persisted lifecycle state of this entity. */
  state: string;

  /** Persisted broker approval identifier; absent for drafts. */
  approvalId: string | null;

  /** Native Mastra workflow run bound to this analysis or report. */
  workflowRunId: string;

  /** Identifiers of the review events recorded by this operation. */
  eventIds: string[];
};
