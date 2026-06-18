import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const greetStep = createStep({
  id: 'greet',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ message: z.string() }),
  execute: async ({ inputData }) => {
    return { message: `Hello, ${inputData.name}!` };
  },
});

export const greetWorkflow = createWorkflow({
  id: 'greet-workflow',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ message: z.string() }),
})
  .then(greetStep)
  .commit();
