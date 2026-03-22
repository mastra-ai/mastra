import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

import { completenessScorer } from '../scorers/index.js';

// --- scored-workflow ---
// A simple workflow whose final step has a scorer attached.
// Used to verify that running this workflow produces a score visible in the UI.

const generateText = createStep({
  id: 'generate-text',
  inputSchema: z.object({ topic: z.string() }),
  outputSchema: z.object({ text: z.string() }),
  scorers: {
    completeness: { scorer: completenessScorer },
  },
  execute: async ({ inputData }) => {
    return { text: `Here is some content about ${inputData.topic}.` };
  },
});

export const scoredWorkflow = createWorkflow({
  id: 'scored-workflow',
  inputSchema: z.object({ topic: z.string() }),
  outputSchema: z.object({ text: z.string() }),
})
  .then(generateText)
  .commit();
