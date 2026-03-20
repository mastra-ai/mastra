import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// --- inner-workflow ---
const transformStep = createStep({
  id: 'transform',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ transformed: z.string() }),
  execute: async ({ inputData }) => {
    return { transformed: inputData.text.toUpperCase() };
  },
});

export const innerWorkflow = createWorkflow({
  id: 'inner-workflow',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ transformed: z.string() }),
})
  .then(transformStep)
  .commit();

// --- outer-workflow ---
const prepareStep = createStep({
  id: 'prepare',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ text: z.string() }),
  execute: async ({ inputData }) => {
    return { text: `processed:${inputData.input}` };
  },
});

const wrapStep = createStep({
  id: 'wrap',
  inputSchema: z.object({ transformed: z.string() }),
  outputSchema: z.object({ final: z.string() }),
  execute: async ({ inputData }) => {
    return { final: `[${inputData.transformed}]` };
  },
});

export const outerWorkflow = createWorkflow({
  id: 'outer-workflow',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ final: z.string() }),
})
  .then(prepareStep)
  .then(innerWorkflow)
  .then(wrapStep)
  .commit();
