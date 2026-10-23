import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { progressSchema } from './prepare-progress.js';

const mergeCompletenessInputSchema = z
  .object({
    'pass-complete-intake-v1': progressSchema.optional(),
    'missing-information-loop-v1': progressSchema.optional(),
  })
  .strict();

export const createMergeCompletenessStep = () =>
  createStep({
    id: 'merge-completeness-v1',
    inputSchema: mergeCompletenessInputSchema,
    outputSchema: progressSchema,
    execute: ({ inputData }) =>
      Promise.resolve(
        progressSchema.parse(inputData['pass-complete-intake-v1'] ?? inputData['missing-information-loop-v1']),
      ),
  });
