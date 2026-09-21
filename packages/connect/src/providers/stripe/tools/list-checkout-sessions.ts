// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listCheckoutSessionsInputSchema = z.object({
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
    .describe('Maximum number of objects to return. Limit can range between 1 and 100, and the default is 10.'),
  customer: z.string().optional().describe('Only return Checkout Sessions for the Customer specified.'),
  status: z
    .enum(['complete', 'expired', 'open'])
    .optional()
    .describe('Only return Checkout Sessions matching the given status.'),
  subscription: z.string().optional().describe('Only return the Checkout Session for the subscription specified.'),
  payment_intent: z.string().optional().describe('Only return the Checkout Session for the PaymentIntent specified.'),
});

const CheckoutSessionSchema = z.object({
  id: z.string(),
  object: z.literal('checkout.session'),
  amount_subtotal: z.number().nullable().optional(),
  amount_total: z.number().nullable().optional(),
  automatic_tax: z
    .object({
      enabled: z.boolean(),
      liability: z.unknown().nullable().optional(),
      status: z.unknown().nullable().optional(),
    })
    .nullable()
    .optional(),
  cancel_url: z.string().nullable().optional(),
  client_reference_id: z.string().nullable().optional(),
  created: z.number(),
  currency: z.string().nullable().optional(),
  customer: z.string().nullable().optional(),
  customer_creation: z.string().nullable().optional(),
  customer_details: z.unknown().nullable().optional(),
  customer_email: z.string().nullable().optional(),
  expires_at: z.number().nullable().optional(),
  invoice: z.string().nullable().optional(),
  livemode: z.boolean(),
  locale: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.string()).nullable().optional(),
  mode: z.string(),
  payment_intent: z.string().nullable().optional(),
  payment_link: z.string().nullable().optional(),
  payment_method_collection: z.string().nullable().optional(),
  payment_method_types: z.array(z.string()).optional(),
  payment_status: z.string(),
  phone_number_collection: z
    .object({
      enabled: z.boolean(),
    })
    .nullable()
    .optional(),
  setup_intent: z.string().nullable().optional(),
  shipping_cost: z.unknown().nullable().optional(),
  shipping_details: z.unknown().nullable().optional(),
  status: z.string().nullable().optional(),
  subscription: z.string().nullable().optional(),
  success_url: z.string().nullable().optional(),
  total_details: z
    .object({
      amount_discount: z.number(),
      amount_shipping: z.number(),
      amount_tax: z.number(),
    })
    .nullable()
    .optional(),
  url: z.string().nullable().optional(),
});

const ListResponseSchema = z.object({
  object: z.literal('list'),
  url: z.string(),
  has_more: z.boolean(),
  data: z.array(z.unknown()),
});

export const listCheckoutSessionsOutputSchema = z.object({
  items: z.array(CheckoutSessionSchema),
  has_more: z.boolean(),
  next_cursor: z.string().optional(),
});

export function listCheckoutSessionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_list_checkout_sessions',
    description: 'List checkout sessions from Stripe.',
    inputSchema: listCheckoutSessionsInputSchema,
    outputSchema: listCheckoutSessionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listCheckoutSessionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.stripe.com/api/checkout/sessions/list
        endpoint: '/v1/checkout/sessions',
        params: {
          ...(input.cursor !== undefined && { starting_after: input.cursor }),
          ...(input.limit !== undefined && { limit: input.limit }),
          ...(input.customer !== undefined && { customer: input.customer }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.subscription !== undefined && { subscription: input.subscription }),
          ...(input.payment_intent !== undefined && { payment_intent: input.payment_intent }),
        },
        retries: 3,
      });

      const listResponse = ListResponseSchema.parse(response.data);
      const items = listResponse.data.map(item => CheckoutSessionSchema.parse(item));
      const lastItem = items.length > 0 ? items[items.length - 1] : null;

      return {
        items,
        has_more: listResponse.has_more,
        ...(listResponse.has_more && lastItem && { next_cursor: lastItem.id }),
      };
    },
  });
}
