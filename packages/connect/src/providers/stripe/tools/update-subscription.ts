// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateSubscriptionInputSchema = z.object({
  id: z.string().describe('The ID of the subscription to update. Example: "sub_xxx"'),
  description: z
    .string()
    .optional()
    .describe('A description of the subscription, meant to be displayable to the customer.'),
  metadata: z
    .record(z.string(), z.string())
    .optional()
    .describe('Set of key-value pairs that you can attach to the subscription.'),
  cancel_at_period_end: z
    .boolean()
    .optional()
    .describe('Indicate whether this subscription should cancel at the end of the current period.'),
  default_payment_method: z.string().optional().describe('ID of the default payment method for the subscription.'),
  proration_behavior: z
    .enum(['create_prorations', 'none', 'always_invoice'])
    .optional()
    .describe('Determines how to handle prorations when the billing cycle changes.'),
});

const ProviderSubscriptionItemSchema = z.object({
  id: z.string(),
  object: z.string(),
  price: z
    .object({
      id: z.string(),
    })
    .optional(),
  quantity: z.number().optional(),
});

const ProviderSubscriptionSchema = z.object({
  id: z.string(),
  object: z.string(),
  status: z.string(),
  customer: z.string(),
  description: z.string().nullable().optional(),
  cancel_at_period_end: z.boolean().optional(),
  current_period_start: z.number().optional(),
  current_period_end: z.number().optional(),
  items: z
    .object({
      object: z.string(),
      data: z.array(ProviderSubscriptionItemSchema),
    })
    .optional(),
});

export const updateSubscriptionOutputSchema = z.object({
  id: z.string(),
  status: z.string(),
  customer: z.string(),
  description: z.string().optional(),
  cancel_at_period_end: z.boolean().optional(),
  current_period_start: z.number().optional(),
  current_period_end: z.number().optional(),
  items: z
    .array(
      z.object({
        id: z.string(),
        price_id: z.string().optional(),
        quantity: z.number().optional(),
      }),
    )
    .optional(),
});

export function updateSubscriptionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_update_subscription',
    description: 'Update a subscription in Stripe.',
    inputSchema: updateSubscriptionInputSchema,
    outputSchema: updateSubscriptionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateSubscriptionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.stripe.com/api/subscriptions/update
      const formData = new URLSearchParams();
      if (input.description !== undefined) {
        formData.append('description', input.description);
      }
      if (input.metadata !== undefined) {
        for (const [key, value] of Object.entries(input.metadata)) {
          formData.append(`metadata[${key}]`, value);
        }
      }
      if (input.cancel_at_period_end !== undefined) {
        formData.append('cancel_at_period_end', String(input.cancel_at_period_end));
      }
      if (input.default_payment_method !== undefined) {
        formData.append('default_payment_method', input.default_payment_method);
      }
      if (input.proration_behavior !== undefined) {
        formData.append('proration_behavior', input.proration_behavior);
      }

      const response = await platformProxy.post({
        endpoint: `/v1/subscriptions/${encodeURIComponent(input.id)}`,
        data: formData.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        retries: 3,
      });

      const providerSubscription = ProviderSubscriptionSchema.parse(response.data);

      return {
        id: providerSubscription.id,
        status: providerSubscription.status,
        customer: providerSubscription.customer,
        ...(providerSubscription.description != null && { description: providerSubscription.description }),
        ...(providerSubscription.cancel_at_period_end !== undefined && {
          cancel_at_period_end: providerSubscription.cancel_at_period_end,
        }),
        ...(providerSubscription.current_period_start !== undefined && {
          current_period_start: providerSubscription.current_period_start,
        }),
        ...(providerSubscription.current_period_end !== undefined && {
          current_period_end: providerSubscription.current_period_end,
        }),
        ...(providerSubscription.items !== undefined && {
          items: providerSubscription.items.data.map(item => ({
            id: item.id,
            ...(item.price != null && { price_id: item.price.id }),
            ...(item.quantity != null && { quantity: item.quantity }),
          })),
        }),
      };
    },
  });
}
