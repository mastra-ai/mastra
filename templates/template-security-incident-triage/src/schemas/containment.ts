import { z } from 'zod';

import { boundedJsonObject, longText, opaqueId, schemaVersion, sha256, utcTimestamp } from './common.js';

export const ContainmentActionTypeSchema = z.enum([
  'revoke_session',
  'restore_previous_role',
  'mark_device_for_review',
  'require_reauthentication',
]);

export const ContainmentActionSchema = z
  .object({
    actionId: opaqueId,
    type: ContainmentActionTypeSchema,
    targetId: opaqueId,
    input: boundedJsonObject,
    impact: longText,
    preconditions: z.array(longText).min(1).max(16),
    rollback: longText,
    verification: longText,
  })
  .strict();

export const ContainmentPlanSchema = z
  .object({
    schemaVersion,
    planId: opaqueId,
    incidentId: opaqueId,
    tenantId: opaqueId,
    planVersion: z.number().int().positive(),
    planHashVersion: z.number().int().positive(),
    planHash: sha256,
    createdAt: utcTimestamp,
    expiresAt: utcTimestamp,
    actions: z.array(ContainmentActionSchema).min(1).max(2),
  })
  .strict()
  .refine(plan => plan.expiresAt > plan.createdAt, {
    message: 'expiresAt must be after createdAt',
    path: ['expiresAt'],
  });

export const ContainmentExecutionStatusSchema = z.enum(['completed', 'blocked', 'failed', 'timed_out']);

export const ContainmentVerificationSchema = z.enum(['verified', 'not_verified', 'not_run']);

export const ContainmentActionOutcomeSchema = z
  .object({
    actionId: opaqueId,
    status: ContainmentExecutionStatusSchema,
    verification: ContainmentVerificationSchema,
    providerRef: opaqueId.optional(),
    errorCode: z
      .enum([
        'ACTION_BLOCKED',
        'PRECONDITION_FAILED',
        'RATE_LIMITED',
        'PROVIDER_FAILED',
        'PROVIDER_TIMEOUT',
        'VERIFICATION_FAILED',
      ])
      .optional(),
  })
  .strict();

export type ContainmentActionType = z.infer<typeof ContainmentActionTypeSchema>;
export type ContainmentAction = z.infer<typeof ContainmentActionSchema>;
export type ContainmentPlan = z.infer<typeof ContainmentPlanSchema>;
export type ContainmentActionOutcome = z.infer<typeof ContainmentActionOutcomeSchema>;
