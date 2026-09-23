import { createStep } from '@mastra/core/workflows';

import { progressSchema } from './prepare-progress.js';

export const createPassInsufficientEvidenceStep = () =>
  createStep({
    id: 'pass-insufficient-evidence-v1',
    inputSchema: progressSchema,
    outputSchema: progressSchema,
    execute: ({ inputData }) => Promise.resolve(inputData),
  });
