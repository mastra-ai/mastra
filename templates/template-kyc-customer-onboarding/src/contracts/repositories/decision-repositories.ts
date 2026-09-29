import { z } from 'zod';

import { jurisdictionPolicySchema } from '../policies/policies.js';
import {
  actorIdSchema,
  caseIdSchema,
  idempotencyKeySchema,
  reviewIdSchema,
  tenantIdSchema,
  threadIdSchema,
  timestampSchema,
} from '../../domain/identifiers.js';
import { informationRequestSchema, informationResponseSchema, workflowResumeCommandSchema } from '../../domain/hitl.js';
import { complianceReviewSchema, reviewDecisionRecordSchema, reviewerFeedbackSchema } from '../../domain/review.js';
import { riskAssessmentSchema } from '../../domain/risk.js';

export const casePolicySnapshotSchema = z
  .object({
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    policy: jurisdictionPolicySchema,
    createdAt: timestampSchema,
  })
  .strict();

export const putCasePolicySnapshotInputSchema = z
  .object({ snapshot: casePolicySnapshotSchema, idempotencyKey: idempotencyKeySchema })
  .strict();

export const caseScopedInputSchema = z.object({ tenantId: tenantIdSchema, caseId: caseIdSchema }).strict();

export interface CasePolicySnapshotRepository {
  put(input: z.infer<typeof putCasePolicySnapshotInputSchema>): Promise<z.infer<typeof casePolicySnapshotSchema>>;
  get(input: z.infer<typeof caseScopedInputSchema>): Promise<z.infer<typeof casePolicySnapshotSchema>>;
}

export const createInformationRequestInputSchema = z
  .object({ request: informationRequestSchema, idempotencyKey: idempotencyKeySchema })
  .strict();

export const getInformationRequestInputSchema = z
  .object({ tenantId: tenantIdSchema, requestId: z.string().min(1).max(128) })
  .strict();

export const getInformationResponseInputSchema = z
  .object({ tenantId: tenantIdSchema, responseId: z.string().min(1).max(128) })
  .strict();

export const listPendingActionsInputSchema = z
  .object({ tenantId: tenantIdSchema, threadId: threadIdSchema, now: timestampSchema })
  .strict();

export const listThreadResumeCommandsInputSchema = z
  .object({ tenantId: tenantIdSchema, threadId: threadIdSchema })
  .strict();

export const respondToInformationRequestInputSchema = z
  .object({
    response: informationResponseSchema,
    expectedVersion: z.number().int().positive(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const informationRequestResponseResultSchema = z
  .object({ request: informationRequestSchema, response: informationResponseSchema })
  .strict();

export interface InformationRequestRepository {
  create(input: z.infer<typeof createInformationRequestInputSchema>): Promise<z.infer<typeof informationRequestSchema>>;
  get(input: z.infer<typeof getInformationRequestInputSchema>): Promise<z.infer<typeof informationRequestSchema>>;
  getResponse(
    input: z.infer<typeof getInformationResponseInputSchema>,
  ): Promise<z.infer<typeof informationResponseSchema>>;
  listPending(
    input: z.infer<typeof listPendingActionsInputSchema>,
  ): Promise<z.infer<typeof informationRequestSchema>[]>;
  respond(
    input: z.infer<typeof respondToInformationRequestInputSchema>,
  ): Promise<z.infer<typeof informationRequestResponseResultSchema>>;
}

export const putRiskAssessmentInputSchema = z
  .object({ assessment: riskAssessmentSchema, idempotencyKey: idempotencyKeySchema })
  .strict();

export const getRiskAssessmentInputSchema = z
  .object({ tenantId: tenantIdSchema, assessmentId: z.string().min(1).max(128) })
  .strict();

export interface RiskAssessmentRepository {
  put(input: z.infer<typeof putRiskAssessmentInputSchema>): Promise<z.infer<typeof riskAssessmentSchema>>;
  get(input: z.infer<typeof getRiskAssessmentInputSchema>): Promise<z.infer<typeof riskAssessmentSchema>>;
  getLatest(input: z.infer<typeof caseScopedInputSchema>): Promise<z.infer<typeof riskAssessmentSchema>>;
}

export const createComplianceReviewInputSchema = z
  .object({ review: complianceReviewSchema, idempotencyKey: idempotencyKeySchema })
  .strict();

export const getComplianceReviewInputSchema = z.object({ tenantId: tenantIdSchema, reviewId: reviewIdSchema }).strict();

export const getReviewDecisionInputSchema = z.object({ tenantId: tenantIdSchema, reviewId: reviewIdSchema }).strict();

export const listComplianceReviewQueueInputSchema = z
  .object({
    tenantId: tenantIdSchema,
    now: timestampSchema,
    requiredRole: z.string().min(1).max(64).optional(),
    afterCreatedAt: timestampSchema.optional(),
    afterReviewId: reviewIdSchema.optional(),
    limit: z.number().int().min(1).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.afterCreatedAt === undefined) !== (value.afterReviewId === undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['afterCreatedAt'],
        message: 'cursor parts must be provided together',
      });
    }
  });

export const decideComplianceReviewInputSchema = z
  .object({
    decision: reviewDecisionRecordSchema,
    feedback: reviewerFeedbackSchema.nullable(),
    expectedVersion: z.number().int().positive(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const complianceReviewDecisionResultSchema = z
  .object({ review: complianceReviewSchema, decision: reviewDecisionRecordSchema })
  .strict();

export interface ComplianceReviewRepository {
  create(input: z.infer<typeof createComplianceReviewInputSchema>): Promise<z.infer<typeof complianceReviewSchema>>;
  get(input: z.infer<typeof getComplianceReviewInputSchema>): Promise<z.infer<typeof complianceReviewSchema>>;
  getDecision(input: z.infer<typeof getReviewDecisionInputSchema>): Promise<z.infer<typeof reviewDecisionRecordSchema>>;
  listPending(input: z.infer<typeof listPendingActionsInputSchema>): Promise<z.infer<typeof complianceReviewSchema>[]>;
  listQueue(
    input: z.infer<typeof listComplianceReviewQueueInputSchema>,
  ): Promise<z.infer<typeof complianceReviewSchema>[]>;
  decide(
    input: z.infer<typeof decideComplianceReviewInputSchema>,
  ): Promise<z.infer<typeof complianceReviewDecisionResultSchema>>;
}

export const createResumeCommandInputSchema = z.object({ command: workflowResumeCommandSchema }).strict();

export const getResumeCommandInputSchema = z
  .object({ tenantId: tenantIdSchema, commandId: z.string().min(1).max(128) })
  .strict();

export const acquireResumeCommandInputSchema = z
  .object({
    tenantId: tenantIdSchema,
    commandId: z.string().min(1).max(128),
    caseId: z.string().min(1).max(128),
    workflowId: z.string().min(1).max(128),
    workflowRunId: z.string().min(1).max(128),
    workflowStepId: z.string().min(1).max(128),
    threadId: threadIdSchema,
    actorId: actorIdSchema,
    actorRoles: z.array(z.string().min(1).max(64)),
    requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    payloadFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    expectedVersion: z.number().int().positive(),
    acquiredAt: timestampSchema,
  })
  .strict();

export const completeResumeCommandInputSchema = z
  .object({
    tenantId: tenantIdSchema,
    commandId: z.string().min(1).max(128),
    expectedVersion: z.number().int().positive(),
    resultReference: z.string().min(1).max(256),
    completedOutcome: z.json(),
    resultFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    completedAt: timestampSchema,
  })
  .strict();

export const resumeAttemptReasonSchema = z.enum([
  'COMMAND_NOT_FOUND',
  'BINDING_INVALID',
  'COMMAND_EXPIRED',
  'STATE_CONFLICT',
  'UNEXPECTED_REJECTION',
]);

export const auditRejectedResumeAttemptInputSchema = acquireResumeCommandInputSchema
  .omit({ expectedVersion: true })
  .extend({ reasonCode: resumeAttemptReasonSchema })
  .strict();

export interface WorkflowResumeCommandRepository {
  create(input: z.infer<typeof createResumeCommandInputSchema>): Promise<z.infer<typeof workflowResumeCommandSchema>>;
  get(input: z.infer<typeof getResumeCommandInputSchema>): Promise<z.infer<typeof workflowResumeCommandSchema>>;
  listPending(
    input: z.infer<typeof listPendingActionsInputSchema>,
  ): Promise<z.infer<typeof workflowResumeCommandSchema>[]>;
  listForThread(
    input: z.infer<typeof listThreadResumeCommandsInputSchema>,
  ): Promise<z.infer<typeof workflowResumeCommandSchema>[]>;
  acquire(input: z.infer<typeof acquireResumeCommandInputSchema>): Promise<z.infer<typeof workflowResumeCommandSchema>>;
  complete(
    input: z.infer<typeof completeResumeCommandInputSchema>,
  ): Promise<z.infer<typeof workflowResumeCommandSchema>>;
  auditRejected(input: z.infer<typeof auditRejectedResumeAttemptInputSchema>): Promise<void>;
}
