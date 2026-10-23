// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listPaymentIntentsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  limit: z.number().int().min(1).max(100).optional().describe('Maximum number of results to return. Defaults to 10.'),
  customer: z
    .string()
    .optional()
    .describe('Only return PaymentIntents for the customer specified by this customer ID.'),
  created_gte: z.number().int().optional().describe('Filter by creation time: minimum timestamp (inclusive).'),
  created_lte: z.number().int().optional().describe('Filter by creation time: maximum timestamp (inclusive).'),
  status: z.string().optional().describe('Only return PaymentIntents with the specified status.'),
});

const PaymentIntentSchema = z
  .object({
    id: z.string(),
    object: z.literal('payment_intent'),
    amount: z.number(),
    currency: z.string(),
    status: z.string(),
    created: z.number(),
    livemode: z.boolean(),
  })
  .passthrough();

export const listPaymentIntentsOutputSchema = z.object({
  items: z.array(PaymentIntentSchema),
  next_cursor: z.string().optional(),
});

export function listPaymentIntentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_list_payment_intents',
    description: 'List payment intents from Stripe.',
    inputSchema: listPaymentIntentsInputSchema,
    outputSchema: listPaymentIntentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPaymentIntentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.stripe.com/api/payment_intents/list
        endpoint: '/v1/payment_intents',
        params: {
          ...(input.cursor !== undefined && { starting_after: input.cursor }),
          ...(input.limit !== undefined && { limit: String(input.limit) }),
          ...(input.customer !== undefined && { customer: input.customer }),
          ...(input.created_gte !== undefined && { 'created[gte]': String(input.created_gte) }),
          ...(input.created_lte !== undefined && { 'created[lte]': String(input.created_lte) }),
          ...(input.status !== undefined && { status: input.status }),
        },
        retries: 3,
      });

      const listResponse = z
        .object({
          object: z.literal('list'),
          data: z.array(z.unknown()),
          has_more: z.boolean(),
        })
        .parse(response.data);

      const items = listResponse.data.map(item => PaymentIntentSchema.parse(item));

      const result: z.infer<typeof listPaymentIntentsOutputSchema> = { items };
      const lastItem = items.at(-1);
      if (listResponse.has_more && lastItem !== undefined) {
        result.next_cursor = lastItem.id;
      }
      return result;
    },
  });
}
