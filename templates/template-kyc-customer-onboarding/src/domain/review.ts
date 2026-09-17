import { z } from 'zod';

import { policyReferenceSchema } from './context.js';
import {
  actorIdSchema,
  caseIdSchema,
  evidenceIdSchema,
  reviewDecisionIdSchema,
  reviewIdSchema,
  riskAssessmentIdSchema,
  tenantIdSchema,
  threadIdSchema,
  timestampSchema,
  workflowRunIdSchema,
  workflowStepIdSchema,
} from './identifiers.js';
import { reasonCodeSchema } from './reasons.js';

export const reviewDecisionSchema = z.enum(['APPROVE', 'REJECT', 'ESCALATE']);

export const complianceReviewSchema = z
  .object({
    id: reviewIdSchema,
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    workflowRunId: workflowRunIdSchema,
    workflowStepId: workflowStepIdSchema,
    threadId: threadIdSchema,
    level: z.enum(['INITIAL', 'SENIOR']),
    priorReviewId: reviewIdSchema.nullable(),
    riskAssessmentId: riskAssessmentIdSchema,
    requiredRole: z.string().min(1).max(64),
    status: z.enum(['PENDING', 'DECIDED', 'EXPIRED']),
    caseReference: z.string().min(1).max(128),
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    riskRoute: z.enum(['AUTO_REVIEW', 'REJECT_RECOMMENDED', 'ESCALATE_RECOMMENDED', 'INSUFFICIENT_INFORMATION']),
    reasonCodes: z.array(reasonCodeSchema),
    policy: policyReferenceSchema,
    evidenceIds: z.array(evidenceIdSchema),
    expiresAt: timestampSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    version: z.number().int().positive(),
  })
  .strict();

export const reviewDecisionRecordSchema = z
  .object({
    id: reviewDecisionIdSchema,
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    reviewId: reviewIdSchema,
    decision: reviewDecisionSchema,
    reviewerId: actorIdSchema,
    reviewerRoles: z.array(z.string().min(1).max(64)).min(1),
    reasonCode: reasonCodeSchema,
    policy: policyReferenceSchema,
    safeNote: z.string().min(1).max(500).nullable(),
    evidenceIds: z.array(evidenceIdSchema).min(1),
    decidedAt: timestampSchema,
  })
  .strict();

export const reviewerFeedbackSchema = z
  .object({
    id: z.string().min(1).max(128),
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    reviewId: reviewIdSchema,
    reviewerId: actorIdSchema,
    extractionUseful: z.boolean().nullable(),
    screeningUseful: z.boolean().nullable(),
    riskUseful: z.boolean().nullable(),
    evidenceUseful: z.boolean().nullable(),
    falsePositiveEscalation: z.boolean().nullable().default(null),
    curatedForDataset: z.boolean().default(false),
    note: z.string().max(500).nullable(),
    createdAt: timestampSchema,
  })
  .strict();

export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export type ComplianceReview = z.infer<typeof complianceReviewSchema>;
export type ReviewDecisionRecord = z.infer<typeof reviewDecisionRecordSchema>;
export type ReviewerFeedback = z.infer<typeof reviewerFeedbackSchema>;
