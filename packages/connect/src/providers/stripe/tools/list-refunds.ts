// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listRefundsInputSchema = z.object({
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor from the previous response. Maps to Stripe starting_after. Omit for the first page.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('A limit on the number of objects to be returned. Default is 10.'),
  charge: z.string().optional().describe('Only return refunds for the charge specified by this charge ID.'),
  payment_intent: z.string().optional().describe('Only return refunds for the PaymentIntent specified by this ID.'),
  created_gte: z.number().int().optional().describe('Minimum created timestamp to filter by (inclusive).'),
  created_gt: z.number().int().optional().describe('Minimum created timestamp to filter by (exclusive).'),
  created_lte: z.number().int().optional().describe('Maximum created timestamp to filter by (inclusive).'),
  created_lt: z.number().int().optional().describe('Maximum created timestamp to filter by (exclusive).'),
});

const RefundSchema = z.object({
  id: z.string(),
  object: z.string(),
  amount: z.number().int(),
  balance_transaction: z.string().optional().nullable(),
  charge: z.string().optional().nullable(),
  created: z.number().int(),
  currency: z.string(),
  destination_details: z.object({}).passthrough().optional().nullable(),
  metadata: z.object({}).passthrough().optional().nullable(),
  payment_intent: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  receipt_number: z.string().optional().nullable(),
  source_transfer_reversal: z.string().optional().nullable(),
  status: z.string(),
  transfer_reversal: z.string().optional().nullable(),
});

export const listRefundsOutputSchema = z.object({
  items: z.array(RefundSchema),
  has_more: z.boolean(),
  next_cursor: z.string().optional(),
});

const StripeListResponseSchema = z.object({
  object: z.string(),
  url: z.string(),
  has_more: z.boolean(),
  data: z.array(z.unknown()),
});

export function listRefundsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_list_refunds',
    description: 'List refunds from Stripe.',
    inputSchema: listRefundsInputSchema,
    outputSchema: listRefundsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listRefundsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.stripe.com/api/refunds/list
      const response = await platformProxy.get({
        endpoint: '/v1/refunds',
        params: {
          ...(input.cursor && { starting_after: input.cursor }),
          ...(input.limit !== undefined && { limit: String(input.limit) }),
          ...(input.charge && { charge: input.charge }),
          ...(input.payment_intent && { payment_intent: input.payment_intent }),
          ...(input.created_gte !== undefined && { 'created[gte]': String(input.created_gte) }),
          ...(input.created_gt !== undefined && { 'created[gt]': String(input.created_gt) }),
          ...(input.created_lte !== undefined && { 'created[lte]': String(input.created_lte) }),
          ...(input.created_lt !== undefined && { 'created[lt]': String(input.created_lt) }),
        },
        retries: 3,
      });

      const rawList = StripeListResponseSchema.parse(response.data);

      const items = rawList.data.map(item => {
        const parsed = RefundSchema.parse(item);
        return parsed;
      });

      const lastItem = items.length > 0 ? items[items.length - 1] : undefined;
      const nextCursor = rawList.has_more && lastItem !== undefined ? lastItem.id : undefined;

      return {
        items,
        has_more: rawList.has_more,
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      };
    },
  });
}
