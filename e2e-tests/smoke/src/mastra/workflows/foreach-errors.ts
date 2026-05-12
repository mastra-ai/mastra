import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// --- foreach-error-workflow ---
// Tests error handling within foreach items — one item throws.
const processOrFail = createStep({
  id: 'process-or-fail',
  inputSchema: z.object({ item: z.string() }),
  outputSchema: z.object({ processed: z.string() }),
  execute: async ({ inputData }) => {
    if (inputData.item === 'FAIL') {
      throw new Error(`Item "${inputData.item}" failed processing`);
    }
    return { processed: inputData.item.toUpperCase() };
  },
});

const produceItemsForError = createStep({
  id: 'produce-items-for-error',
  inputSchema: z.object({ items: z.array(z.string()) }),
  outputSchema: z.array(z.object({ item: z.string() })),
  execute: async ({ inputData }) => {
    return inputData.items.map(item => ({ item }));
  },
});

export const foreachErrorWorkflow = createWorkflow({
  id: 'foreach-error-workflow',
  inputSchema: z.object({ items: z.array(z.string()) }),
  outputSchema: z.array(z.object({ processed: z.string() })),
})
  .then(produceItemsForError)
  .foreach(processOrFail, { concurrency: 1 })
  .commit();

// --- foreach-retry-workflow ---
// Tests retry within foreach items — item fails first attempt, succeeds on retry.
const processWithRetry = createStep({
  id: 'process-with-retry',
  inputSchema: z.object({ item: z.string() }),
  outputSchema: z.object({ processed: z.string(), attempts: z.number() }),
  retries: 2,
  execute: async ({ inputData, retryCount }) => {
    if (inputData.item === 'flaky' && retryCount < 1) {
      throw new Error(`Flaky item failed on attempt ${retryCount + 1}`);
    }
    return { processed: inputData.item.toUpperCase(), attempts: retryCount + 1 };
  },
});

const produceItemsForRetry = createStep({
  id: 'produce-items-for-retry',
  inputSchema: z.object({ items: z.array(z.string()) }),
  outputSchema: z.array(z.object({ item: z.string() })),
  execute: async ({ inputData }) => {
    return inputData.items.map(item => ({ item }));
  },
});

export const foreachRetryWorkflow = createWorkflow({
  id: 'foreach-retry-workflow',
  inputSchema: z.object({ items: z.array(z.string()) }),
  outputSchema: z.array(z.object({ processed: z.string(), attempts: z.number() })),
})
  .then(produceItemsForRetry)
  .foreach(processWithRetry, { concurrency: 1 })
  .commit();
