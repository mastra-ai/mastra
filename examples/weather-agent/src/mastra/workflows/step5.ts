import { createWorkflow, createStep } from '@mastra/core/workflows/vNext';
import { z } from 'zod';

const incrementStep = createStep({
  id: 'increment',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ inputData }) => {
    return { value: inputData.value + 1 };
  },
});

const finalStep = createStep({
  id: 'final',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ inputData }) => {
    return { value: inputData.value };
  },
});

const workflow = createWorkflow({
  id: 'increment-workflow',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
})
  .dountil(incrementStep, async ({ inputData }) => inputData.value >= 10)
  .then(finalStep);

workflow.commit();

export { workflow as incrementWorkflow };
