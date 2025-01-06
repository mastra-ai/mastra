import { Workflow, Step } from '@mastra/core';
import { z } from 'zod';

const logCatName = new Step({
  id: 'logCatName',
  inputSchema: z.object({
    name: z.string(),
  }),
  outputSchema: z.object({
    rawText: z.string(),
  }),
  execute: async ({ context }) => {
    console.log(`Hello, ${context.name} 🐈`);
    return { rawText: `Hello ${context.name}` };
  },
});

export const logCatWorkflow = new Workflow({
  name: 'hello-workflow',
  triggerSchema: z.object({
    name: z.string(),
  }),
});

logCatWorkflow.step(logCatName, {
  variables: {
    name: {
      step: 'trigger',
      path: 'name',
    },
  },
});

logCatWorkflow.commit();
