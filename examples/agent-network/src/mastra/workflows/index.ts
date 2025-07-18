import { createStep, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';

export const newWorkflow = new Workflow({
  id: 'newWorkflow',
  inputSchema: z.object({
    prompt: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  steps: [
    createStep({
      id: 'createStep',
      inputSchema: z.object({
        prompt: z.string(),
      }),
      outputSchema: z.object({
        result: z.string(),
      }),
      execute: async context => {
        return { result: 'abcd' };
      },
    }),
  ],
});
