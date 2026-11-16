/** Default-engine billing workflow registered by both processes in foreach-billing-restart.test.ts. */
import { createStep, createWorkflow } from '@mastra/core/workflows';

const customerSchema = { type: 'number' } as const;
const customersSchema = { type: 'array', items: customerSchema } as const;
const chargedSchema = {
  type: 'object',
  properties: { charged: { type: 'number' } },
  required: ['charged'],
} as const;

export function createBillingWorkflow(concurrency: number, charge: (customer: number) => Promise<void>) {
  const step = createStep({
    id: 'charge',
    inputSchema: customerSchema,
    outputSchema: chargedSchema,
    execute: async ({ inputData }) => {
      await charge(inputData);
      return { charged: inputData };
    },
  });
  return createWorkflow({
    id: `foreach-billing-${concurrency}`,
    inputSchema: customersSchema,
    outputSchema: { type: 'array', items: chargedSchema },
  })
    .foreach(step, { concurrency })
    .commit();
}
