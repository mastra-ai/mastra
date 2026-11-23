/** Default-engine billing workflow registered by both processes in foreach-billing-restart.test.ts. */
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const chargedSchema = z.object({ charged: z.number() });

export function createBillingWorkflow(concurrency: number, charge: (customer: number) => Promise<void>) {
  const step = createStep({
    id: 'charge',
    inputSchema: z.number(),
    outputSchema: chargedSchema,
    execute: async ({ inputData }) => {
      await charge(inputData);
      return { charged: inputData };
    },
  });
  return createWorkflow({
    id: `foreach-billing-${concurrency}`,
    inputSchema: z.array(z.number()),
    outputSchema: z.array(chargedSchema),
  })
    .foreach(step, { concurrency })
    .commit();
}
