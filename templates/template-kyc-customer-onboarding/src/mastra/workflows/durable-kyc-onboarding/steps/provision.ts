import { createStep } from '@mastra/core/workflows';
import type { z } from 'zod';

import { ProviderError } from '../../../../contracts/shared/provider.js';
import type { accountProvisioningResultSchema } from '../../../../domain/provisioning.js';
import { DomainInvariantError } from '../../../../domain/errors.js';
import { withKycProviderSpan } from '../../../../observability/provider-span.js';
import { kycWorkflowRequestContextSchema } from '../../kyc-application-intake.js';
import {
  contextFrom,
  durableKycWorkflowOutputSchema,
  systemActor,
  type DurableKycWorkflowDependencies,
} from '../contracts.js';
import type { Transition } from '../runtime.js';
import { reviewProgressSchema } from './prepare-review.js';

export const createProvisionStep = (dependencies: DurableKycWorkflowDependencies, transition: Transition) =>
  createStep({
    id: 'provision-approved-account-v1',
    inputSchema: reviewProgressSchema,
    outputSchema: durableKycWorkflowOutputSchema,
    requestContextSchema: kycWorkflowRequestContextSchema,
    execute: async ({ inputData, requestContext, tracingContext, runId }) => {
      const context = kycWorkflowRequestContextSchema.parse(requestContext.all);
      const execution = { ...contextFrom(context), actor: systemActor };
      if (inputData.reviewId === null || inputData.decisionId === null || inputData.decision === null) {
        throw new DomainInvariantError('Final review decision is missing');
      }
      if (inputData.decision === 'REJECT') {
        return durableKycWorkflowOutputSchema.parse({
          caseId: inputData.caseId,
          status: 'REJECTED',
          decision: 'REJECT',
          riskAssessmentId: inputData.riskAssessmentId,
          riskLevel: inputData.riskLevel,
          riskRoute: inputData.riskRoute,
          reviewId: inputData.reviewId,
          decisionId: inputData.decisionId,
          account: null,
          evidenceIds: inputData.evidenceIds,
          automaticSteps: [...inputData.automaticSteps, 'audited-human-rejection'],
          message: 'The application was rejected after audited human review.',
        });
      }
      await transition({
        execution,
        caseId: inputData.caseId,
        command: 'BEGIN_PROVISIONING',
        reasonCode: 'REVIEW_APPROVED',
        actor: systemActor,
        evidenceIds: inputData.evidenceIds,
        idempotencyKey: `${inputData.idempotencyKey}:begin-provisioning`,
      });
      const now = dependencies.clock.now();
      let account: z.infer<typeof accountProvisioningResultSchema>;
      try {
        account = await withKycProviderSpan(
          tracingContext,
          {
            providerId: dependencies.provisioning.id,
            operation: 'ACCOUNT_PROVISIONING',
            tenantRef: context.tenantId,
            caseRef: inputData.caseId,
            attempt: 1,
          },
          () =>
            dependencies.provisioning.provision(
              {
                tenantId: context.tenantId,
                caseId: inputData.caseId,
                idempotencyKey: `${inputData.idempotencyKey}:provision-account`,
              },
              {
                execution,
                deadlineAt: new Date(now.getTime() + dependencies.timeoutMs).toISOString(),
                attempt: 1,
                idempotencyKey: `${inputData.idempotencyKey}:provision-account`,
              },
            ),
        );
      } catch (error) {
        await dependencies.providerMetrics
          .recordProvider({
            tenantId: context.tenantId,
            eventId: `provider:${inputData.caseId}:provisioning:error`,
            caseId: inputData.caseId,
            providerId: dependencies.provisioning.id,
            operation: 'ACCOUNT_PROVISIONING',
            outcome: error instanceof ProviderError && error.details.code === 'PROVIDER_TIMEOUT' ? 'timeout' : 'error',
            startedAt: now.toISOString(),
            completedAt: dependencies.clock.now().toISOString(),
            attemptCount: 1,
            retryCount: 0,
          })
          .catch(() => undefined);
        await dependencies.providerMetrics
          .recordWorkflowStep?.({
            tenantId: context.tenantId,
            eventId: `workflow-step:${inputData.caseId}:provisioning:error`,
            caseId: inputData.caseId,
            workflowId: 'durable-kyc-onboarding-v1',
            runId,
            stepId: 'provision-approved-account-v1',
            outcome: 'error',
            startedAt: now.toISOString(),
            completedAt: dependencies.clock.now().toISOString(),
          })
          .catch(() => undefined);
        await transition({
          execution,
          caseId: inputData.caseId,
          command: 'FAIL_PROVISIONING',
          reasonCode: 'PROVISIONING_ACCOUNT_PROVISIONING_FAILED',
          actor: systemActor,
          evidenceIds: inputData.evidenceIds,
          idempotencyKey: `${inputData.idempotencyKey}:fail-provisioning`,
        });
        return durableKycWorkflowOutputSchema.parse({
          caseId: inputData.caseId,
          status: 'PROVISIONING_FAILED',
          decision: 'APPROVE',
          riskAssessmentId: inputData.riskAssessmentId,
          riskLevel: inputData.riskLevel,
          riskRoute: inputData.riskRoute,
          reviewId: inputData.reviewId,
          decisionId: inputData.decisionId,
          account: null,
          evidenceIds: inputData.evidenceIds,
          automaticSteps: [...inputData.automaticSteps, 'provisioning-failure-recorded'],
          message: 'The application was approved, but account provisioning failed safely.',
        });
      }
      await dependencies.providerMetrics
        .recordProvider({
          tenantId: context.tenantId,
          eventId: `provider:${inputData.caseId}:provisioning:success`,
          caseId: inputData.caseId,
          providerId: dependencies.provisioning.id,
          operation: 'ACCOUNT_PROVISIONING',
          outcome: 'success',
          startedAt: now.toISOString(),
          completedAt: account.provisionedAt,
          attemptCount: 1,
          retryCount: 0,
        })
        .catch(() => undefined);
      await dependencies.providerMetrics
        .recordWorkflowStep?.({
          tenantId: context.tenantId,
          eventId: `workflow-step:${inputData.caseId}:provisioning:success`,
          caseId: inputData.caseId,
          workflowId: 'durable-kyc-onboarding-v1',
          runId,
          stepId: 'provision-approved-account-v1',
          outcome: 'success',
          startedAt: now.toISOString(),
          completedAt: account.provisionedAt,
        })
        .catch(() => undefined);
      await transition({
        execution,
        caseId: inputData.caseId,
        command: 'ACTIVATE',
        reasonCode: 'PROVISIONING_ACCOUNT_PROVISIONED',
        actor: systemActor,
        evidenceIds: inputData.evidenceIds,
        idempotencyKey: `${inputData.idempotencyKey}:activate-account`,
      });
      return durableKycWorkflowOutputSchema.parse({
        caseId: inputData.caseId,
        status: 'ACTIVE',
        decision: 'APPROVE',
        riskAssessmentId: inputData.riskAssessmentId,
        riskLevel: inputData.riskLevel,
        riskRoute: inputData.riskRoute,
        reviewId: inputData.reviewId,
        decisionId: inputData.decisionId,
        account,
        evidenceIds: inputData.evidenceIds,
        automaticSteps: [...inputData.automaticSteps, 'idempotent-account-provisioning'],
        message: 'The application was approved and the simulated account is active.',
      });
    },
  });
