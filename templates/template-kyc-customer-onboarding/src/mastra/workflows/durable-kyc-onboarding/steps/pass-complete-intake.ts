import { createStep } from '@mastra/core/workflows';

import { progressSchema } from './prepare-progress.js';

export const createPassCompleteIntakeStep = () =>
  createStep({
    id: 'pass-complete-intake-v1',
    inputSchema: progressSchema,
    outputSchema: progressSchema,
    execute: ({ inputData }) => Promise.resolve(inputData),
  });
