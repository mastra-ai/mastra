import { z } from 'zod';

import { longText, opaqueId, schemaVersion, sha256, utcTimestamp } from './common.js';

const approvalBase = {
  schemaVersion,
  approvalId: opaqueId,
  planId: opaqueId,
  incidentId: opaqueId,
  tenantId: opaqueId,
  planHashVersion: z.number().int().positive(),
  planHash: sha256,
};

export const ApprovalSuspendPayloadSchema = z
  .object({
    incidentId: opaqueId,
    workflowRunId: opaqueId,
    approvalId: opaqueId,
    planHashVersion: z.literal(1),
    planHash: sha256,
    expiresAt: utcTimestamp,
  })
  .strict();

export const ApprovalResumePayloadSchema = z
  .object({
    resumeReceiptId: opaqueId,
  })
  .strict();

export const AuthenticatedDecisionContextSchema = z
  .object({
    actorId: opaqueId,
    tenantId: opaqueId,
    role: z.enum(['viewer', 'soc_analyst', 'soc_manager']),
    local: z.boolean(),
  })
  .strict();

export const ApprovalDecisionRequestSchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    reason: longText.optional(),
    // Authenticated source-only fields are deliberately not persisted or
    // included in decision events/traces.
    comment: longText.optional(),
    actorHint: longText.optional(),
    planId: opaqueId,
    planHashVersion: z.literal(1),
    planHash: sha256,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.decision === 'rejected' && !value.reason?.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'reason is required for rejection',
      });
    }
  });

export const AuthoritativeApprovalResultSchema = z
  .object({
    approvalId: opaqueId,
    planId: opaqueId,
    incidentId: opaqueId,
    tenantId: opaqueId,
    workflowRunId: opaqueId,
    planHashVersion: z.literal(1),
    planHash: sha256,
    decision: z.enum(['approved', 'rejected']),
    decidedBy: opaqueId,
    decidedByRole: z.literal('soc_manager'),
    decidedAt: utcTimestamp,
    expiresAt: utcTimestamp,
  })
  .strict();

export const ExpiredApprovalResultSchema = z
  .object({
    approvalId: opaqueId,
    planId: opaqueId,
    incidentId: opaqueId,
    tenantId: opaqueId,
    workflowRunId: opaqueId,
    planHashVersion: z.literal(1),
    planHash: sha256,
    decision: z.literal('expired'),
    expiredAt: utcTimestamp,
    expiresAt: utcTimestamp,
  })
  .strict();

export const ApprovalRequestSchema = z
  .object({
    ...approvalBase,
    requestedAt: utcTimestamp,
    expiresAt: utcTimestamp,
    status: z.literal('pending'),
  })
  .strict()
  .refine(request => request.expiresAt > request.requestedAt, {
    message: 'expiresAt must be after requestedAt',
    path: ['expiresAt'],
  });

export const ApprovalDecisionSchema = z.discriminatedUnion('decision', [
  z
    .object({
      ...approvalBase,
      decision: z.literal('approved'),
      decidedBy: opaqueId,
      decidedByRole: z.literal('soc_manager'),
      decidedAt: utcTimestamp,
      reason: longText.optional(),
    })
    .strict(),
  z
    .object({
      ...approvalBase,
      decision: z.literal('rejected'),
      decidedBy: opaqueId,
      decidedByRole: z.literal('soc_manager'),
      decidedAt: utcTimestamp,
      reason: longText,
    })
    .strict(),
]);

export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
export type AuthenticatedDecisionContext = z.infer<typeof AuthenticatedDecisionContextSchema>;
export type AuthoritativeApprovalResult = z.infer<typeof AuthoritativeApprovalResultSchema>;
export type ExpiredApprovalResult = z.infer<typeof ExpiredApprovalResultSchema>;
