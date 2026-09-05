import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const formatGreeting = createStep({
  id: 'format-greeting',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ message: z.string() }),
  execute: async ({ inputData }) => ({ message: `Hello, ${inputData.name}!` }),
});

export const greetingWorkflow = createWorkflow({
  id: 'greeting-workflow',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ message: z.string() }),
})
  .then(formatGreeting)
  .commit();
