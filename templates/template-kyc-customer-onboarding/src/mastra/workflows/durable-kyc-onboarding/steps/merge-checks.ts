import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { progressSchema } from './prepare-progress.js';

const mergeChecksInputSchema = z
  .object({
    'resumed-verification-checks-v1': progressSchema.optional(),
    'pass-existing-checks-v1': progressSchema.optional(),
    'pass-insufficient-evidence-v1': progressSchema.optional(),
  })
  .strict();

export const createMergeChecksStep = () =>
  createStep({
    id: 'merge-check-paths-v1',
    inputSchema: mergeChecksInputSchema,
    outputSchema: progressSchema,
    execute: ({ inputData }) =>
      Promise.resolve(
        progressSchema.parse(
          inputData['resumed-verification-checks-v1'] ??
            inputData['pass-existing-checks-v1'] ??
            inputData['pass-insufficient-evidence-v1'],
        ),
      ),
  });
