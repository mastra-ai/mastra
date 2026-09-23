import { setTimeout as delay } from 'node:timers/promises';
import { createStep } from '@mastra/core/workflows';
import { z } from 'zod/v4';
import { orderInputSchema } from './schemas';

const preparedOrderSchema = orderInputSchema.extend({ totalUnits: z.number().int().positive() });

export const prepareOrder = createStep({
  id: 'prepare-order',
  description: 'Count the order units. A one-second step to inspect or debug.',
  inputSchema: orderInputSchema,
  outputSchema: preparedOrderSchema,
  execute: async ({ inputData, abortSignal }) => {
    await delay(1000, undefined, { signal: abortSignal });
    return { ...inputData, totalUnits: inputData.items.reduce((total, item) => total + item.quantity, 0) };
  },
});

export const checkInventory = createStep({
  id: 'check-inventory',
  description: 'Check local sample inventory in parallel with the risk assessment.',
  inputSchema: preparedOrderSchema,
  outputSchema: preparedOrderSchema.extend({ inventory: z.literal('available') }),
  execute: async ({ inputData, abortSignal }) => {
    await delay(2000, undefined, { signal: abortSignal });
    return { ...inputData, inventory: 'available' as const };
  },
});

export const assessRisk = createStep({
  id: 'assess-risk',
  description: 'Complete the sample risk check while inventory is still running.',
  inputSchema: preparedOrderSchema,
  outputSchema: z.object({ risk: z.literal('low') }),
  execute: async ({ abortSignal }) => {
    await delay(1000, undefined, { signal: abortSignal });
    return { risk: 'low' as const };
  },
});
