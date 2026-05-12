import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// --- sleep-workflow ---
// Short sleep (2s) that completes successfully.
const beforeStep = createStep({
  id: 'before-sleep-step',
  inputSchema: z.object({ label: z.string() }),
  outputSchema: z.object({ label: z.string(), timestamp: z.number() }),
  execute: async ({ inputData }) => {
    return { label: inputData.label, timestamp: Date.now() };
  },
});

const afterStep = createStep({
  id: 'after-sleep-step',
  inputSchema: z.object({ label: z.string(), timestamp: z.number() }),
  outputSchema: z.object({ label: z.string(), sleptMs: z.number() }),
  execute: async ({ inputData }) => {
    const elapsed = Date.now() - inputData.timestamp;
    return { label: inputData.label, sleptMs: elapsed };
  },
});

export const sleepWorkflow = createWorkflow({
  id: 'sleep-workflow',
  inputSchema: z.object({ label: z.string() }),
  outputSchema: z.object({ label: z.string(), sleptMs: z.number() }),
})
  .then(beforeStep)
  .sleep(2000)
  .then(afterStep)
  .commit();
