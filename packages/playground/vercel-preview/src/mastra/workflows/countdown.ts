import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod/v4';

export const countdownInputSchema = z.object({ remaining: z.number().int().min(0).max(10).default(3) });

const decrement = createStep({
  id: 'decrement',
  inputSchema: countdownInputSchema,
  outputSchema: countdownInputSchema,
  execute: async ({ inputData }) => ({ remaining: Math.max(0, inputData.remaining - 1) }),
});

export const countdown = createWorkflow({
  id: 'countdown',
  description: 'Repeat a step until the countdown reaches zero. Start with a number between 0 and 10.',
  inputSchema: countdownInputSchema,
  outputSchema: countdownInputSchema,
})
  .dountil(decrement, async ({ inputData }) => inputData.remaining === 0)
  .commit();
