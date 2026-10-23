import { z } from 'zod';
import { reportSnapshotSchema, reportHash } from './reports.js';
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const common = { operationId: z.uuid(), snapshotId: z.uuid(), snapshotHash: hash, snapshot: reportSnapshotSchema };
const approvalSchema = z
  .object({
    id: z.uuid(),
    snapshotId: z.uuid(),
    snapshotHash: hash,
    reviewerId: z.string().min(1).max(200),
    approvedAt: z.iso.datetime(),
  })
  .strict();
const binding = (request: {
  snapshotId: string;
  snapshotHash: string;
  snapshot: z.infer<typeof reportSnapshotSchema>;
}) => request.snapshotId === request.snapshot.id && request.snapshotHash === reportHash(request.snapshot);
export const draftOutputRequestSchema = z
  .object({ ...common, stage: z.literal('draftOutput') })
  .strict()
  .refine(binding, 'Snapshot identity and checksum must match the immutable report.');
const approvedBinding = (request: Omit<z.infer<typeof reportOutputRequestObject>, 'stage'> & { stage: string }) =>
  binding(request) &&
  request.approval.snapshotId === request.snapshotId &&
  request.approval.snapshotHash === request.snapshotHash;
const reportOutputRequestObject = z
  .object({ ...common, stage: z.literal('reportOutput'), approval: approvalSchema })
  .strict();
export const reportOutputRequestSchema = reportOutputRequestObject.refine(
  approvedBinding,
  'Output requires an approval bound to this report snapshot.',
);
export const correctionOutputRequestSchema = z
  .object({ ...common, stage: z.literal('correctionOutput'), approval: approvalSchema })
  .strict()
  .refine(approvedBinding, 'Output requires an approval bound to this report snapshot.');
export type DraftOutputRequest = z.infer<typeof draftOutputRequestSchema>;
export type OutputRequest<C extends 'draftOutput' | 'reportOutput' | 'correctionOutput'> = C extends 'draftOutput'
  ? DraftOutputRequest
  : C extends 'reportOutput'
    ? z.infer<typeof reportOutputRequestSchema>
    : z.infer<typeof correctionOutputRequestSchema>;
