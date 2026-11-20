import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { StudioCaseLinkRepository } from '../../contracts/repositories/studio-case-link-repository.js';
import { WorkflowExecutionError } from '../../domain/errors.js';
import { workflowRunIdSchema } from '../../domain/identifiers.js';
import { kycTracingOptions } from '../../observability/tracing.js';
import { kycWorkflowRequestContextSchema } from '../workflows/kyc-application-intake.js';
import {
  durableKycWorkflowOutputSchema,
  durableKycWorkflowStateSchema,
  type DurableKycOnboardingWorkflow,
} from '../workflows/durable-kyc-onboarding.js';
import {
  createStudioRequestContext,
  deriveStudioThreadKey,
  serializeStudioThread,
  type TrustedKycStudioDefaults,
} from './studio-context.js';
import { parseWorkflowPendingAction, workflowPendingActionSchema } from './workflow-pending-action.js';

export const startKycApplicationToolInputSchema = z
  .object({
    scenarioId: z.enum([
      'low-risk-v1',
      'missing-information-v1',
      'unreadable-document-v1',
      'identity-mismatch-v1',
      'address-inconclusive-v1',
      'sanctions-strong-v1',
      'pep-candidate-v1',
    ]),
  })
  .strict();

export const startKycApplicationToolOutputSchema = z
  .object({
    caseId: z.string().min(1).max(128),
    workflowRunId: workflowRunIdSchema,
    status: z.enum(['SUSPENDED', 'COMPLETED']),
    pendingAction: z.union(workflowPendingActionSchema.options).nullable(),
    result: durableKycWorkflowOutputSchema.nullable(),
    message: z.string().min(1).max(500),
    replayed: z.boolean(),
  })
  .strict();

const deriveStudioIdentifiers = (tenantId: string, threadId: string, scenarioId: string) => {
  const digest = createHash('sha256')
    .update(tenantId)
    .update('\0')
    .update(threadId)
    .update('\0')
    .update(scenarioId)
    .digest('hex');
  return Object.freeze({
    threadKey: threadId,
    workflowRunId: `workflow-${digest.slice(0, 32)}`,
    idempotencyKey: `studio-${scenarioId}-${digest}`,
  });
};

const workflowScenario = {
  'low-risk-v1': 'low-risk',
  'missing-information-v1': 'missing-fields',
  'unreadable-document-v1': 'unreadable',
  'identity-mismatch-v1': 'identity-mismatch',
  'address-inconclusive-v1': 'address-inconclusive',
  'sanctions-strong-v1': 'sanctions-strong',
  'pep-candidate-v1': 'pep-candidate',
} as const;

export const createStartKycApplicationTool = (
  workflow: DurableKycOnboardingWorkflow,
  studioCaseLinks: StudioCaseLinkRepository,
  trustedDefaults: TrustedKycStudioDefaults,
) =>
  createTool({
    id: 'start-kyc-application-v1',
    description:
      'Start the bundled synthetic low-risk KYC intake and complete every currently available automatic step',
    inputSchema: startKycApplicationToolInputSchema,
    outputSchema: startKycApplicationToolOutputSchema,
    strict: true,
    mcp: {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    execute: async (input, context) => {
      const studio = createStudioRequestContext(trustedDefaults, {
        type: 'applicant',
        id: 'studio-applicant',
        roles: ['applicant'],
      });
      const requestContext = kycWorkflowRequestContextSchema.parse(studio.value);
      const identifiers = deriveStudioIdentifiers(
        requestContext.tenantId,
        deriveStudioThreadKey(requestContext.tenantId, context.agent?.threadId),
        input.scenarioId,
      );
      return serializeStudioThread(`${requestContext.tenantId}:${identifiers.threadKey}`, async () => {
        const existing = await studioCaseLinks.getByRun({
          tenantId: requestContext.tenantId,
          workflowRunId: identifiers.workflowRunId,
        });
        if (existing !== undefined) {
          const storedRun = await workflow.getWorkflowRunById(existing.workflowRunId, {
            fields: ['result', 'steps', 'suspendedPaths', 'resumeLabels'],
          });
          if (storedRun?.status === 'success') {
            return startKycApplicationToolOutputSchema.parse({
              caseId: existing.caseId,
              workflowRunId: existing.workflowRunId,
              status: 'COMPLETED',
              pendingAction: null,
              result: durableKycWorkflowOutputSchema.parse(storedRun.result),
              message: 'The durable onboarding workflow is complete.',
              replayed: true,
            });
          }
          if (storedRun?.status === 'suspended') {
            const pendingAction = parseWorkflowPendingAction(storedRun);
            return startKycApplicationToolOutputSchema.parse({
              caseId: existing.caseId,
              workflowRunId: existing.workflowRunId,
              status: 'SUSPENDED',
              pendingAction,
              result: null,
              message: 'The durable onboarding workflow is waiting for a bounded human action.',
              replayed: true,
            });
          }
        }

        const run = await workflow.createRun({ runId: identifiers.workflowRunId });
        const result = await run.start({
          inputData: {
            scenario: workflowScenario[input.scenarioId],
            idempotencyKey: identifiers.idempotencyKey,
            studioThreadKey: identifiers.threadKey,
          },
          initialState: durableKycWorkflowStateSchema.parse({}),
          requestContext: studio.requestContext,
          tracingOptions: kycTracingOptions({
            operation: 'kyc.studio.workflow.start',
            tenantId: requestContext.tenantId,
            correlationId: requestContext.correlationId,
          }),
        });
        if (result.status === 'suspended') {
          return startKycApplicationToolOutputSchema.parse({
            caseId:
              result.state?.caseId ??
              (
                await studioCaseLinks.getByRun({
                  tenantId: requestContext.tenantId,
                  workflowRunId: identifiers.workflowRunId,
                })
              )?.caseId,
            workflowRunId: identifiers.workflowRunId,
            status: 'SUSPENDED',
            pendingAction: parseWorkflowPendingAction(result),
            result: null,
            message: 'The durable onboarding workflow is waiting for a bounded human action.',
            replayed: existing !== undefined,
          });
        }
        if (result.status !== 'success') throw new WorkflowExecutionError();

        return startKycApplicationToolOutputSchema.parse({
          caseId: result.result.caseId,
          workflowRunId: identifiers.workflowRunId,
          status: 'COMPLETED',
          pendingAction: null,
          result: result.result,
          message: 'The durable onboarding workflow is complete.',
          replayed: existing !== undefined,
        });
      });
    },
  });

export type StartKycApplicationTool = ReturnType<typeof createStartKycApplicationTool>;
import { createHash } from 'node:crypto';
