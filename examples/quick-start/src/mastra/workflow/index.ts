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
  action: async ({ data: { name } }) => {
    console.log(`Hello, ${name} 🐈`);
    return { rawText: `Hello ${name}` };
  },
});

export const logCatWorkflow = new Workflow({
  name: 'hello-workflow',
  triggerSchema: z.object({
    name: z.string(),
  }),
  steps: [logCatName],
});

logCatWorkflow.step('logCatName', {
  variables: {
    name: {
      stepId: 'trigger',
      path: '', // passes in entire payload
    },
  },
});
