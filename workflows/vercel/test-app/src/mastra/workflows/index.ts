import { z } from 'zod';
import { createStep } from '@mastra/core/workflows';
import { VercelWorkflow } from '@mastra/vercel';

const step1 = createStep({
  id: 'step1',
  execute: async ({ inputData }) => {
    console.log('[step1] Executing with input:', inputData);
    return { value: 'step1-output' };
  },
  inputSchema: z.object({}),
  outputSchema: z.object({ value: z.string() }),
});

const step2 = createStep({
  id: 'step2',
  execute: async ({ inputData }) => {
    console.log('[step2] Executing with input:', inputData);
    return { value: `step2-received-${inputData.value}` };
  },
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ value: z.string() }),
});

export const testWorkflow = new VercelWorkflow({
  id: 'test-workflow',
  inputSchema: z.object({}),
  outputSchema: z.object({ value: z.string() }),
})
  .then(step1)
  .then(step2)
  .commit();
