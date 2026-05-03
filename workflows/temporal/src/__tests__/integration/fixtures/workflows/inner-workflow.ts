import { z } from 'zod';
import { createStep, createWorkflow } from '../temporal';

export const innerStep = createStep({
  id: 'inner-step',
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ value: z.string() }),
  execute: async ({ inputData }) => ({ value: `${inputData.value}-inner` }),
});

export const innerWorkflow = createWorkflow({
  id: 'inner-workflow',
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ value: z.string() }),
})
  .then(innerStep)
  .commit();
