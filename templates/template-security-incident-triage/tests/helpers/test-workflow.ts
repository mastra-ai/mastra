import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const inputSchema = z.object({ message: z.string().min(1) });
const outputSchema = z.object({
  message: z.string(),
  status: z.literal('ready'),
});

const step = createStep({
  id: 'test-check',
  inputSchema,
  outputSchema,
  execute: async ({ inputData }) => ({
    message: inputData.message,
    status: 'ready' as const,
  }),
});

export const testWorkflow = createWorkflow({
  id: 'test-workflow',
  inputSchema,
  outputSchema,
})
  .then(step)
  .commit();
