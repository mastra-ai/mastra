import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// --- retry-workflow ---
// Step fails on retryCount 0 and 1, succeeds on retryCount 2 (3rd attempt).
// `retries: 3` means 3 retries after initial attempt = 4 total attempts allowed.
const flakyStep = createStep({
  id: 'flaky-step',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ result: z.string(), attempts: z.number() }),
  retries: 3,
  execute: async ({ inputData, retryCount }) => {
    if (retryCount < 2) {
      throw new Error(`Attempt ${retryCount + 1} failed`);
    }
    return { result: inputData.message, attempts: retryCount + 1 };
  },
});

export const retryWorkflow = createWorkflow({
  id: 'retry-workflow',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ result: z.string(), attempts: z.number() }),
})
  .then(flakyStep)
  .commit();

// --- failure-workflow ---
const alwaysFails = createStep({
  id: 'always-fails',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async () => {
    throw new Error('Intentional failure for smoke test');
  },
});

export const failureWorkflow = createWorkflow({
  id: 'failure-workflow',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ result: z.string() }),
})
  .then(alwaysFails)
  .commit();

// --- cancelable-workflow ---
const beforeSleep = createStep({
  id: 'before-sleep',
  inputSchema: z.object({ label: z.string() }),
  outputSchema: z.object({ label: z.string(), started: z.boolean() }),
  execute: async ({ inputData }) => {
    return { label: inputData.label, started: true };
  },
});

const afterSleep = createStep({
  id: 'after-sleep',
  inputSchema: z.object({ label: z.string(), started: z.boolean() }),
  outputSchema: z.object({ label: z.string(), completed: z.boolean() }),
  execute: async ({ inputData }) => {
    return { label: inputData.label, completed: true };
  },
});

export const cancelableWorkflow = createWorkflow({
  id: 'cancelable-workflow',
  inputSchema: z.object({ label: z.string() }),
  outputSchema: z.object({ label: z.string(), completed: z.boolean() }),
})
  .then(beforeSleep)
  .sleep(60_000)
  .then(afterSleep)
  .commit();
