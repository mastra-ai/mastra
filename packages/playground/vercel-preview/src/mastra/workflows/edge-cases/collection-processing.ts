import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod/v4';

export const collectionInputSchema = z
  .object({
    items: z.array(z.string().min(1).max(160)).max(6).default(['Repeated item', 'Repeated item', 'Café · 日本語']),
    failAt: z
      .number()
      .int()
      .min(-1)
      .max(5)
      .default(-1)
      .describe('Zero-based item to fail. Use -1 to process every item.'),
  })
  .refine(collection => collection.failAt < collection.items.length, {
    path: ['failAt'],
    message: 'Choose an existing item, or -1 to disable failure.',
  });

const itemSchema = z.object({ value: z.string(), index: z.number(), fail: z.boolean() });
const processedItemSchema = z.object({ value: z.string(), index: z.number() });

const processItem = createStep({
  id: 'process-collection-item',
  description: 'Process each item in order. An intentional failure preserves earlier iteration results.',
  inputSchema: itemSchema,
  outputSchema: processedItemSchema,
  execute: async ({ inputData }) => {
    if (inputData.fail) throw new Error(`Item ${inputData.index + 1} failed: ${inputData.value}`);
    return { value: inputData.value, index: inputData.index };
  },
});

const collectionOutputSchema = z.object({
  processed: z.number(),
  items: z.array(processedItemSchema),
  optionalNote: z.null(),
  hasWarnings: z.boolean(),
  warningCount: z.number(),
  warnings: z.array(z.string()),
});

const summarizeCollection = createTool({
  id: 'summarize-collection',
  description: 'Return the actual items with null, false, zero, and empty-array fields for inspecting data rendering.',
  inputSchema: z.array(processedItemSchema),
  outputSchema: collectionOutputSchema,
  execute: async items => ({
    processed: items.length,
    items,
    optionalNote: null,
    hasWarnings: false,
    warningCount: 0,
    warnings: [],
  }),
});

export const collectionProcessing = createWorkflow({
  id: 'collection-processing',
  description: 'Inspect empty or repeated items, Unicode labels, a failed loop iteration, and a real tool step.',
  inputSchema: collectionInputSchema,
  outputSchema: collectionOutputSchema,
})
  .map(async ({ inputData }) =>
    inputData.items.map((value, index) => ({ value, index, fail: index === inputData.failAt })),
  )
  .foreach(processItem, { concurrency: 1 })
  .tool(summarizeCollection)
  .commit();
