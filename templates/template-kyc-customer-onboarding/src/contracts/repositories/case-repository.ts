import { z } from 'zod';

import { initialKycCaseSchema, kycCaseSchema } from '../../domain/case.js';
import { actorSchema, policyReferenceSchema } from '../../domain/context.js';
import { caseEventSchema, transitionCommandSchema } from '../../domain/events.js';
import {
  caseIdSchema,
  correlationIdSchema,
  eventIdSchema,
  evidenceIdSchema,
  idempotencyKeySchema,
  tenantIdSchema,
  timestampSchema,
  workflowRunIdSchema,
} from '../../domain/identifiers.js';

export const createCaseInputSchema = z
  .object({
    case: initialKycCaseSchema,
    eventId: eventIdSchema,
    actor: actorSchema,
    correlationId: correlationIdSchema,
    policy: policyReferenceSchema,
    idempotencyKey: idempotencyKeySchema,
    requestFingerprint: z.string().min(1).max(128),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.case.policy.id !== value.policy.id ||
      value.case.policy.version !== value.policy.version ||
      value.case.policy.checksum !== value.policy.checksum
    ) {
      context.addIssue({
        code: 'custom',
        path: ['policy'],
        message: 'case policy must match the creation policy reference',
      });
    }
  });

export const getCaseInputSchema = z.object({ tenantId: tenantIdSchema, caseId: caseIdSchema }).strict();

export const transitionCaseRepositoryInputSchema = z
  .object({
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    expectedVersion: z.number().int().positive(),
    command: transitionCommandSchema.exclude(['CREATE_CASE']),
    eventId: eventIdSchema,
    reasonCode: z.string().min(1).max(100),
    actor: actorSchema,
    occurredAt: timestampSchema,
    correlationId: correlationIdSchema,
    policy: policyReferenceSchema,
    evidenceIds: z.array(evidenceIdSchema),
    idempotencyKey: idempotencyKeySchema,
    requestFingerprint: z.string().min(1).max(128),
    workflowRunId: workflowRunIdSchema.optional(),
  })
  .strict();

export const caseMutationResultSchema = z
  .object({ case: kycCaseSchema, event: caseEventSchema, replayed: z.boolean() })
  .strict();

export type CreateCaseInput = z.infer<typeof createCaseInputSchema>;
export type GetCaseInput = z.infer<typeof getCaseInputSchema>;
export type TransitionCaseRepositoryInput = z.infer<typeof transitionCaseRepositoryInputSchema>;
export type CaseMutationResult = z.infer<typeof caseMutationResultSchema>;

export interface CaseRepository {
  create(input: CreateCaseInput): Promise<CaseMutationResult>;
  get(input: GetCaseInput): Promise<z.infer<typeof kycCaseSchema>>;
  transition(input: TransitionCaseRepositoryInput): Promise<CaseMutationResult>;
}
