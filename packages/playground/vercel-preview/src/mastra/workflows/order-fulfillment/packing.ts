import { setTimeout as delay } from 'node:timers/promises';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod/v4';
import { approvedOrderSchema, orderItemSchema, packedItemSchema, packedOrderSchema } from './schemas';

const printLabel = createStep({
  id: 'print-label',
  description: 'Create a local package label. No printer or external service is called.',
  inputSchema: orderItemSchema,
  outputSchema: orderItemSchema.extend({ label: z.string() }),
  execute: async ({ inputData, abortSignal }) => {
    await delay(1500, undefined, { signal: abortSignal });
    return { ...inputData, label: `${inputData.quantity} × ${inputData.name}` };
  },
});

const checkQuality = createStep({
  id: 'check-quality',
  description: 'Complete the sample quality check alongside label preparation.',
  inputSchema: orderItemSchema,
  outputSchema: z.object({ quality: z.literal('passed') }),
  execute: async ({ abortSignal }) => {
    await delay(2500, undefined, { signal: abortSignal });
    return { quality: 'passed' as const };
  },
});

const packItem = createWorkflow({
  id: 'pack-item',
  description: 'For every item, prepare its label and check quality in parallel.',
  inputSchema: orderItemSchema,
  outputSchema: packedItemSchema,
})
  .parallel([printLabel, checkQuality])
  .map(async ({ inputData }) => ({ ...inputData['print-label'], ...inputData['check-quality'] }))
  .commit();

export const packOrder = createWorkflow({
  id: 'pack-order',
  description: 'Open this workflow to inspect the packing loop. Two items are processed at a time.',
  inputSchema: approvedOrderSchema,
  outputSchema: packedOrderSchema,
})
  .map(async ({ inputData }) => inputData.items)
  .foreach(packItem, { concurrency: 2 })
  .map(async ({ inputData, getInitData }) => ({
    ...getInitData<z.infer<typeof approvedOrderSchema>>(),
    packages: inputData,
  }))
  .commit();
