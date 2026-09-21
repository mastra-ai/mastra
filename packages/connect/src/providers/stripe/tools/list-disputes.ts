// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listDisputesInputSchema = z.object({
  cursor: z
    .string()
    .optional()
    .describe(
      "Pagination cursor from the previous response. Maps to Stripe's starting_after. Omit for the first page.",
    ),
  charge: z.string().optional().describe('Only return disputes associated to the charge specified by this charge ID.'),
  payment_intent: z
    .string()
    .optional()
    .describe('Only return disputes associated to the PaymentIntent specified by this PaymentIntent ID.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe(
      'A limit on the number of objects to be returned. Limit can range between 1 and 100, and the default is 10.',
    ),
  created_after: z
    .number()
    .int()
    .optional()
    .describe('Only return disputes that were created after this Unix timestamp. Maps to created[gte].'),
  created_before: z
    .number()
    .int()
    .optional()
    .describe('Only return disputes that were created before this Unix timestamp. Maps to created[lte].'),
});

const DisputeSchema = z
  .object({
    id: z.string(),
    object: z.literal('dispute'),
    amount: z.number(),
    charge: z.string(),
    currency: z.string(),
    created: z.number(),
    evidence_details: z
      .object({
        due_by: z.number().nullable().optional(),
        has_evidence: z.boolean().optional(),
        past_due: z.boolean().optional(),
        submission_count: z.number().optional(),
      })
      .optional(),
    is_charge_refundable: z.boolean().optional(),
    livemode: z.boolean().optional(),
    metadata: z.record(z.string(), z.string()).optional(),
    payment_intent: z.string().nullable().optional(),
    reason: z.string().optional(),
    status: z.string(),
  })
  .passthrough();

const ListResponseSchema = z.object({
  object: z.literal('list'),
  url: z.string().optional(),
  has_more: z.boolean(),
  data: z.array(DisputeSchema),
});

export const listDisputesOutputSchema = z.object({
  items: z.array(DisputeSchema),
  next_cursor: z.string().optional(),
});

export function listDisputesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_list_disputes',
    description: 'List disputes from Stripe.',
    inputSchema: listDisputesInputSchema,
    outputSchema: listDisputesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listDisputesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};

      if (input.cursor !== undefined) {
        params['starting_after'] = input.cursor;
      }
      if (input.charge !== undefined) {
        params['charge'] = input.charge;
      }
      if (input.payment_intent !== undefined) {
        params['payment_intent'] = input.payment_intent;
      }
      if (input.limit !== undefined) {
        params['limit'] = input.limit;
      }
      if (input.created_after !== undefined) {
        params['created[gte]'] = input.created_after;
      }
      if (input.created_before !== undefined) {
        params['created[lte]'] = input.created_before;
      }

      // https://docs.stripe.com/api/disputes/list
      const response = await platformProxy.get({
        endpoint: '/v1/disputes',
        params,
        retries: 3,
      });

      const listResponse = ListResponseSchema.parse(response.data);

      const items = listResponse.data;
      const lastItem = items.length > 0 ? items[items.length - 1] : undefined;
      const nextCursor = listResponse.has_more && lastItem !== undefined ? lastItem.id : undefined;

      return {
        items,
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      };
    },
  });
}
