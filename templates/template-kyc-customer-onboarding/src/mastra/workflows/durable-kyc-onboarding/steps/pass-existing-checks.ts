import { createStep } from '@mastra/core/workflows';

import { progressSchema } from './prepare-progress.js';

export const createPassExistingChecksStep = () =>
  createStep({
    id: 'pass-existing-checks-v1',
    inputSchema: progressSchema,
    outputSchema: progressSchema,
    execute: ({ inputData }) => Promise.resolve(inputData),
  });
