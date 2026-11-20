import { z } from 'zod';

import { actorSchema, policyReferenceSchema } from './context.js';
import { kycCaseStatusSchema } from './case.js';
import {
  caseIdSchema,
  correlationIdSchema,
  eventIdSchema,
  evidenceIdSchema,
  idempotencyKeySchema,
  tenantIdSchema,
  timestampSchema,
} from './identifiers.js';

export const transitionCommandSchema = z.enum([
  'CREATE_CASE',
  'SUBMIT_APPLICATION',
  'BEGIN_EXTRACTION',
  'ADD_DOCUMENT',
  'BEGIN_CHECKS',
  'REQUEST_INFORMATION',
  'EXHAUST_INFORMATION_REQUESTS',
  'BEGIN_RISK_ASSESSMENT',
  'RESUME_EXTRACTION',
  'REQUEST_COMPLIANCE_REVIEW',
  'APPROVE',
  'REJECT',
  'ESCALATE',
  'RETURN_TO_COMPLIANCE_REVIEW',
  'BEGIN_PROVISIONING',
  'ACTIVATE',
  'FAIL_PROVISIONING',
]);

export const caseStatusTransitionedEventSchema = z
  .object({
    type: z.literal('CASE_STATUS_TRANSITIONED'),
    id: eventIdSchema,
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    previousStatus: kycCaseStatusSchema,
    nextStatus: kycCaseStatusSchema,
    command: transitionCommandSchema.exclude(['CREATE_CASE']),
    reasonCode: z.string().min(1).max(100),
    actor: actorSchema,
    occurredAt: timestampSchema,
    correlationId: correlationIdSchema,
    policy: policyReferenceSchema,
    evidenceIds: z.array(evidenceIdSchema),
    idempotencyKey: idempotencyKeySchema,
    caseVersion: z.number().int().positive(),
  })
  .strict();

export const caseCreatedEventSchema = z
  .object({
    type: z.literal('CASE_CREATED'),
    id: eventIdSchema,
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    nextStatus: z.literal('DRAFT'),
    command: z.literal('CREATE_CASE'),
    reasonCode: z.literal('CASE_CREATED'),
    actor: actorSchema,
    occurredAt: timestampSchema,
    correlationId: correlationIdSchema,
    policy: policyReferenceSchema,
    evidenceIds: z.array(evidenceIdSchema),
    idempotencyKey: idempotencyKeySchema,
    caseVersion: z.literal(1),
  })
  .strict();

export const caseEventSchema = z.discriminatedUnion('type', [
  caseCreatedEventSchema,
  caseStatusTransitionedEventSchema,
]);

export type TransitionCommand = z.infer<typeof transitionCommandSchema>;
export type CaseStatusTransitionedEvent = z.infer<typeof caseStatusTransitionedEventSchema>;
export type CaseCreatedEvent = z.infer<typeof caseCreatedEventSchema>;
export type CaseEvent = z.infer<typeof caseEventSchema>;
