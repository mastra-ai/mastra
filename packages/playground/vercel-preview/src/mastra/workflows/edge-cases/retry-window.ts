import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod/v4';

export const retryWindowInputSchema = z.object({
  readyAfter: z.number().int().min(1).max(4).default(3),
  delayMs: z.number().int().min(0).max(1000).default(250),
  stopEarly: z.boolean().default(false).describe('Bail out before the loop or waiting steps.'),
});

const retryWindowOutputSchema = z.object({ attempts: z.number(), message: z.string() });
const readinessSchema = retryWindowInputSchema.extend({ attempts: z.number().int().nonnegative() });

const prepareWindow = createStep({
  id: 'prepare-retry-window',
  inputSchema: retryWindowInputSchema,
  outputSchema: readinessSchema,
  execute: async ({ inputData, bail }) => {
    if (inputData.stopEarly) return bail({ attempts: 0, message: 'Stopped before retrying.' });
    return { ...inputData, attempts: 0 };
  },
});

const checkReadiness = createStep({
  id: 'check-readiness',
  inputSchema: readinessSchema,
  outputSchema: readinessSchema,
  execute: async ({ inputData }) => ({ ...inputData, attempts: inputData.attempts + 1 }),
});

export const retryWindow = createWorkflow({
  id: 'retry-window',
  description:
    'Do-while, computed delay, a past deadline, and a computed deadline. Stop early to leave later steps unstarted.',
  inputSchema: retryWindowInputSchema,
  outputSchema: retryWindowOutputSchema,
})
  .then(prepareWindow)
  .dowhile(checkReadiness, async ({ inputData }) => inputData.attempts < inputData.readyAfter)
  .sleep(async ({ inputData }) => inputData.delayMs, { id: 'computed-delay' })
  .sleepUntil(new Date(0), { id: 'past-deadline', description: 'A deadline already passed, so execution continues.' })
  .sleepUntil(async ({ inputData }) => new Date(Date.now() + inputData.delayMs), { id: 'computed-deadline' })
  .map(async ({ inputData }) => ({ attempts: inputData.attempts, message: 'Ready after the waiting window.' }))
  .commit();
