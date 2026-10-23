import { createStep } from '@mastra/core/workflows';

import { verificationCheckToolInputSchema } from '../../../tools/verification-checks.js';
import { progressSchema } from './prepare-progress.js';

export const createPrepareResumedChecksStep = () =>
  createStep({
    id: 'prepare-resumed-checks-v1',
    inputSchema: progressSchema,
    outputSchema: verificationCheckToolInputSchema,
    execute: ({ inputData, runId }) =>
      Promise.resolve({
        caseId: inputData.caseId,
        documentId: inputData.documentId,
        idempotencyKey: `${inputData.idempotencyKey}:resumed-verification-run`,
        workflowRunId: runId,
      }),
  });
