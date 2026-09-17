import { createStep } from '@mastra/core/workflows';

import { verificationCheckToolInputSchema } from '../../../tools/verification-checks.js';
import { contextFrom, kycWorkflowRequestContextSchema, type KycApplicationWorkflowDependencies } from '../contracts.js';
import { extractionAssessedSchema } from './assess-completeness.js';

export const createRouteReadyStep = (dependencies: KycApplicationWorkflowDependencies) =>
  createStep({
    id: 'route-ready-for-checks-v1',
    inputSchema: extractionAssessedSchema,
    outputSchema: verificationCheckToolInputSchema,
    requestContextSchema: kycWorkflowRequestContextSchema,
    execute: async ({ inputData, requestContext, runId }) => {
      const context = kycWorkflowRequestContextSchema.parse(requestContext.all);
      const result = await dependencies.extractionRouting.route({
        execution: contextFrom(context),
        caseId: inputData.caseId,
        evidenceId: inputData.evidenceId,
        assessment: inputData.assessment,
        idempotencyKey: `${inputData.idempotencyKey}:routing`,
      });
      if (result.status !== 'CHECKING') throw new Error('Ready route did not enter CHECKING');
      return verificationCheckToolInputSchema.parse({
        caseId: inputData.caseId,
        documentId: inputData.documentId,
        idempotencyKey: `${inputData.idempotencyKey}:verification-run`,
        workflowRunId: runId,
      });
    },
  });
