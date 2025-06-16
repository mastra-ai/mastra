import { createStep, createWorkflow } from '@mastra/core';
import { z } from 'zod';

const myStep = createStep({
  id: 'test-step',
  description: 'A test step',
  inputSchema: z.object({
    input: z.string(),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async ({ inputData }) => {
    return { output: inputData.input };
  },
});

const myStep2 = createStep({
  id: 'test-step-2',
  description: 'A test step 2',
  inputSchema: z.object({
    input: z.string(),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async ({ inputData }) => {
    return { output: inputData.input };
  },
});

const myWorkflow = createWorkflow({
  id: 'test-workflow',
  description: 'A test workflow',
  inputSchema: z.object({
    input: z.string(),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
}).then(myStep);

myWorkflow.commit();
