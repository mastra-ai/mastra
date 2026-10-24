import { z } from 'zod';
import { outputArtifactSchema } from './case-contracts.js';
import type { Failure } from './operation-errors.js';
import { reportHash, reportSnapshotSchema } from './report-contracts.js';
import { approvalSchema } from './review-contracts.js';
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const common = {
  operationId: z.uuid().describe('UUID identifying one idempotent operation; changed input requires a new identifier.'),
  snapshotId: z.uuid().describe('Identifier of the immutable report snapshot.'),
  snapshotHash: hash.describe('SHA-256 checksum binding this request to the exact report snapshot.'),
  snapshot: reportSnapshotSchema.describe('Complete immutable report snapshot consumed by the output provider.'),
};
const binding = (request: {
  snapshotId: string;
  snapshotHash: string;
  snapshot: z.infer<typeof reportSnapshotSchema>;
}) => request.snapshotId === request.snapshot.id && request.snapshotHash === reportHash(request.snapshot);
export const draftOutputRequestSchema = z
  .object({
    ...common,
    stage: z.literal('draftOutput').describe('Provider output stage: draft, approved report or proposed correction.'),
  })
  .strict()
  .refine(binding, 'Snapshot identity and checksum must match the immutable report.');
const approvedBinding = (request: Omit<z.infer<typeof reportOutputRequestObject>, 'stage'> & { stage: string }) =>
  binding(request) &&
  request.approval.snapshotId === request.snapshotId &&
  request.approval.snapshotHash === request.snapshotHash &&
  request.approval.caseId === request.snapshot.caseId &&
  request.approval.version === request.snapshot.version &&
  request.approval.workflowRunId === request.snapshot.workflowRunId;
const reportOutputRequestObject = z
  .object({
    ...common,
    stage: z.literal('reportOutput').describe('Provider output stage: draft, approved report or proposed correction.'),
    approval: approvalSchema.describe('Persisted approval binding the exact snapshot and review event set.'),
  })
  .strict();
export const reportOutputRequestSchema = reportOutputRequestObject.refine(
  approvedBinding,
  'Output requires an approval bound to this report snapshot.',
);
export const correctionOutputRequestSchema = z
  .object({
    ...common,
    stage: z
      .literal('correctionOutput')
      .describe('Provider output stage: draft, approved report or proposed correction.'),
    approval: approvalSchema.describe('Persisted approval binding the exact snapshot and review event set.'),
  })
  .strict()
  .refine(approvedBinding, 'Output requires an approval bound to this report snapshot.');
export type DraftOutputRequest = z.infer<typeof draftOutputRequestSchema>;
export type OutputRequest<C extends 'draftOutput' | 'reportOutput' | 'correctionOutput'> = C extends 'draftOutput'
  ? DraftOutputRequest
  : C extends 'reportOutput'
    ? z.infer<typeof reportOutputRequestSchema>
    : z.infer<typeof correctionOutputRequestSchema>;

export type FinalArtifact = {
  /** Stable identifier of this persisted entity. */
  id: string;

  /** UUID identifying one idempotent operation; changed input requires a new identifier. */
  operationId: string;

  /** Provider output stage: draft, approved report or proposed correction. */
  stage: 'reportOutput' | 'correctionOutput';

  /** Stable identifier of the provider that captured or produced this item. */
  providerId: string;

  /** Verified provider artifact descriptor; null before successful materialization. */
  descriptor: z.infer<typeof outputArtifactSchema> | null;
};
export type Finalization = {
  /** Stable identifier of this persisted entity. */
  id: string;

  /** Identifier of the exact immutable report version. */
  reportId: string;

  /** Identifier of the case selected in this conversation. */
  caseId: string;

  /** Persisted broker approval identifier; absent for drafts. */
  approvalId: string;

  /** Persisted lifecycle state of this entity. */
  state: 'PREPARED' | 'PUBLISHED';

  /** Reserved or verified artifacts belonging to this finalization. */
  artifacts: FinalArtifact[];

  /** Safe recorded failure; null or absent when no failure is recorded. */
  failure: Failure | null;
};
