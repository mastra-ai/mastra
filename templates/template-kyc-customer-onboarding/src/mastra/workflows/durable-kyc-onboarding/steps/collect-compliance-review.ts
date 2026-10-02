import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import type { Actor } from '../../../../domain/context.js';
import { DomainInvariantError } from '../../../../domain/errors.js';
import { resumeCommandIdSchema, reviewDecisionIdSchema, reviewIdSchema } from '../../../../domain/identifiers.js';
import { kycWorkflowRequestContextSchema } from '../../kyc-application-intake.js';
import {
  contextFrom,
  durableKycWorkflowStateSchema,
  reviewerFor,
  riskRouteReason,
  riskRouteSchema,
  systemActor,
  type DurableKycWorkflowDependencies,
} from '../contracts.js';
import type { MeasureWorkflowStep, Transition } from '../runtime.js';
import { reviewProgressSchema } from './prepare-review.js';

export const complianceReviewSuspendSchema = z
  .object({
    action: z.literal('COMPLIANCE_REVIEW'),
    caseReference: z.string().min(1).max(128),
    reviewId: reviewIdSchema,
    commandId: resumeCommandIdSchema,
    level: z.enum(['INITIAL', 'SENIOR']),
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    riskRoute: riskRouteSchema,
    reasonCodes: z.array(z.string().min(1).max(100)),
    safeMessage: z.string().min(1).max(500),
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const complianceReviewResumeSchema = z
  .object({ commandId: resumeCommandIdSchema, decisionId: reviewDecisionIdSchema })
  .strict();

export const createCollectComplianceReviewStep = (
  dependencies: DurableKycWorkflowDependencies,
  transition: Transition,
  measureWorkflowStep: MeasureWorkflowStep,
) =>
  createStep({
    id: 'collect-compliance-review-v1',
    inputSchema: reviewProgressSchema,
    outputSchema: reviewProgressSchema,
    stateSchema: durableKycWorkflowStateSchema,
    requestContextSchema: kycWorkflowRequestContextSchema,
    suspendSchema: complianceReviewSuspendSchema,
    resumeSchema: complianceReviewResumeSchema,
    execute: async stepContext => {
      const { inputData, requestContext, workflowId, runId, resumeData, state } = stepContext;
      const context = kycWorkflowRequestContextSchema.parse(requestContext.all);
      const execution = contextFrom(context);
      if (resumeData === undefined || state.currentAction !== 'COMPLIANCE_REVIEW' || state.currentActionId === null) {
        if (inputData.reviewId === null && inputData.reviewLevel === 'INITIAL') {
          await transition({
            execution,
            caseId: inputData.caseId,
            command: 'REQUEST_COMPLIANCE_REVIEW',
            reasonCode: riskRouteReason(inputData.riskRoute),
            actor: systemActor,
            evidenceIds: inputData.evidenceIds,
            idempotencyKey: `${inputData.idempotencyKey}:begin-review`,
          });
        }
        const reviewer = reviewerFor(inputData.threadId, inputData.reviewLevel);
        const opened = await dependencies.complianceReview.open({
          tenantId: context.tenantId,
          caseId: inputData.caseId,
          workflowId,
          workflowRunId: runId,
          workflowStepId: 'collect-compliance-review-v1',
          threadId: inputData.threadId,
          level: inputData.reviewLevel,
          priorReviewId: inputData.priorReviewId,
          authorizedReviewer: reviewer,
          idempotencyKey: `${inputData.idempotencyKey}:review`,
        });
        await stepContext.setState({
          ...state,
          currentAction: 'COMPLIANCE_REVIEW',
          currentActionId: opened.review.id,
          reviewLevel: inputData.reviewLevel,
        });
        return stepContext.suspend(
          {
            action: 'COMPLIANCE_REVIEW',
            caseReference: opened.review.caseReference,
            reviewId: opened.review.id,
            commandId: opened.command.id,
            level: opened.review.level,
            riskLevel: opened.review.riskLevel,
            riskRoute: opened.review.riskRoute,
            reasonCodes: opened.review.reasonCodes,
            safeMessage: `${opened.review.level === 'INITIAL' ? 'An' : 'A'} ${opened.review.level.toLowerCase()} compliance decision is required.`,
            expiresAt: opened.review.expiresAt,
          },
          { resumeLabel: `compliance-review-${opened.review.id}` },
        );
      }
      return measureWorkflowStep({
        tenantId: context.tenantId,
        eventId: `workflow-step:${inputData.caseId}:review:${resumeData.decisionId}`,
        caseId: inputData.caseId,
        runId,
        stepId: 'process-compliance-review-decision-v1',
        operation: async () => {
          const command = await dependencies.resumeCommands.get({
            tenantId: context.tenantId,
            commandId: resumeData.commandId,
          });
          const decision = await dependencies.reviews.getDecision({
            tenantId: context.tenantId,
            reviewId: command.targetId,
          });
          const review = await dependencies.reviews.get({
            tenantId: context.tenantId,
            reviewId: command.targetId,
          });
          if (
            command.status !== 'EXECUTING' ||
            command.actionType !== 'COMPLIANCE_REVIEW' ||
            command.workflowRunId !== runId ||
            command.workflowStepId !== 'collect-compliance-review-v1' ||
            command.threadId !== inputData.threadId ||
            command.caseId !== inputData.caseId ||
            command.resumePayloadId !== decision.id ||
            decision.id !== resumeData.decisionId ||
            decision.reviewId !== review.id ||
            review.status !== 'DECIDED'
          ) {
            throw new DomainInvariantError('Persisted compliance-review resume binding is invalid');
          }
          const reviewer: Actor = {
            type: 'reviewer',
            id: decision.reviewerId,
            roles: decision.reviewerRoles,
          };
          if (decision.decision === 'ESCALATE') {
            await transition({
              execution,
              caseId: inputData.caseId,
              command: 'ESCALATE',
              reasonCode: decision.reasonCode,
              actor: reviewer,
              evidenceIds: decision.evidenceIds,
              idempotencyKey: `${inputData.idempotencyKey}:escalate-review`,
            });
            await transition({
              execution,
              caseId: inputData.caseId,
              command: 'RETURN_TO_COMPLIANCE_REVIEW',
              reasonCode: 'REVIEW_ESCALATED',
              actor: reviewerFor(inputData.threadId, 'SENIOR'),
              evidenceIds: decision.evidenceIds,
              idempotencyKey: `${inputData.idempotencyKey}:begin-senior-review`,
            });
          } else {
            await transition({
              execution,
              caseId: inputData.caseId,
              command: decision.decision === 'APPROVE' ? 'APPROVE' : 'REJECT',
              reasonCode: decision.reasonCode,
              actor: reviewer,
              evidenceIds: decision.evidenceIds,
              idempotencyKey: `${inputData.idempotencyKey}:final-review-decision`,
            });
          }
          await stepContext.setState({
            ...state,
            currentAction: 'NONE',
            currentActionId: null,
            reviewLevel: decision.decision === 'ESCALATE' ? 'SENIOR' : inputData.reviewLevel,
          });
          return reviewProgressSchema.parse({
            ...inputData,
            reviewId: decision.decision === 'ESCALATE' ? null : review.id,
            priorReviewId: decision.decision === 'ESCALATE' ? review.id : inputData.priorReviewId,
            decisionId: decision.decision === 'ESCALATE' ? null : decision.id,
            decision: decision.decision === 'ESCALATE' ? null : decision.decision,
            reviewLevel: decision.decision === 'ESCALATE' ? 'SENIOR' : inputData.reviewLevel,
            needsSeniorReview: decision.decision === 'ESCALATE',
          });
        },
      });
    },
  });
