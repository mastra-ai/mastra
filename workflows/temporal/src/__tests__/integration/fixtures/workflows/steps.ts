import { z } from 'zod';
import { createStep } from '../temporal';

export const step1 = createStep({
  id: 'step1',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ value: z.string() }),
  execute: async ({ inputData }) => ({ value: `${inputData.input}-step1` }),
});

export const step2 = createStep({
  id: 'step2',
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ step2: z.string() }),
  execute: async ({ inputData }) => ({ step2: `${inputData.value}-step2` }),
});

export const step3 = createStep({
  id: 'step3',
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ step3: z.string() }),
  execute: async ({ inputData }) => ({ step3: `${inputData.value}-step3` }),
});

export const step4 = createStep({
  id: 'step4',
  inputSchema: z.object({
    step2: z.object({ step2: z.string() }),
    step3: z.object({ step3: z.string() }),
  }),
  outputSchema: z.object({ result: z.string() }),
  execute: async ({ inputData }) => ({ result: `${inputData.step2.step2}|${inputData.step3.step3}|final` }),
});
