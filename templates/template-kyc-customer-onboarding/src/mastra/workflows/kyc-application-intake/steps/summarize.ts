import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { kycApplicationWorkflowOutputSchema } from '../contracts.js';

const summarizeInputSchema = z
  .object({
    'ready-for-verification-checks-v1': kycApplicationWorkflowOutputSchema.optional(),
    'route-missing-information-v1': kycApplicationWorkflowOutputSchema.optional(),
  })
  .strict();

export const createSummarizeStep = () =>
  createStep({
    id: 'summarize-phase-two-v1',
    inputSchema: summarizeInputSchema,
    outputSchema: kycApplicationWorkflowOutputSchema,
    execute: ({ inputData }) =>
      Promise.resolve(
        kycApplicationWorkflowOutputSchema.parse(
          inputData['ready-for-verification-checks-v1'] ?? inputData['route-missing-information-v1'],
        ),
      ),
  });
