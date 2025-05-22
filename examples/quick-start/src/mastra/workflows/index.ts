import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const logCatName = createStep({
  id: 'logCatName',
  inputSchema: z.object({
    name: z.string(),
  }),
  outputSchema: z.object({
    rawText: z.string(),
  }),
  execute: async ({ inputData }) => {
    console.log(`Hello, ${inputData.name} 🐈`);
    return { rawText: `Hello ${inputData.name}` };
  },
});

export const logCatWorkflow = createWorkflow({
  id: 'log-cat-workflow',
  inputSchema: z.object({
    name: z.string(),
  }),
  outputSchema: z.object({
    rawText: z.string(),
  }),
  steps: [logCatName],
})
  .then(logCatName)
  .commit();
