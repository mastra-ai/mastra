// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getSubscriptionInputSchema = z.object({
  id: z.string().describe('The ID of the subscription to retrieve. Example: "sub_1MowQVLkdIwHu7ixeRlqHVzs"'),
});

export const getSubscriptionOutputSchema = z
  .object({
    id: z.string(),
    object: z.literal('subscription'),
    application: z.string().nullable().optional(),
    application_fee_percent: z.number().nullable().optional(),
    automatic_tax: z.record(z.string(), z.unknown()).nullable().optional(),
    billing_cycle_anchor: z.number().optional(),
    billing_thresholds: z.record(z.string(), z.unknown()).nullable().optional(),
    cancel_at: z.number().nullable().optional(),
    cancel_at_period_end: z.boolean().optional(),
    canceled_at: z.number().nullable().optional(),
    cancellation_details: z.record(z.string(), z.unknown()).nullable().optional(),
    collection_method: z.string().nullable().optional(),
    created: z.number().optional(),
    currency: z.string().optional(),
    current_period_end: z.number().optional(),
    current_period_start: z.number().optional(),
    customer: z.string().optional(),
    days_until_due: z.number().nullable().optional(),
    default_payment_method: z.string().nullable().optional(),
    default_source: z.string().nullable().optional(),
    default_tax_rates: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
    description: z.string().nullable().optional(),
    discount: z.record(z.string(), z.unknown()).nullable().optional(),
    discounts: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
    ended_at: z.number().nullable().optional(),
    invoice_settings: z.record(z.string(), z.unknown()).nullable().optional(),
    items: z
      .object({
        object: z.literal('list').optional(),
        data: z.array(z.record(z.string(), z.unknown())),
        has_more: z.boolean().optional(),
        total_count: z.number().optional(),
        url: z.string().optional(),
      })
      .passthrough()
      .optional(),
    latest_invoice: z.string().nullable().optional(),
    livemode: z.boolean().optional(),
    metadata: z.record(z.string(), z.string()).nullable().optional(),
    next_pending_invoice_item_invoice: z.string().nullable().optional(),
    on_behalf_of: z.string().nullable().optional(),
    pause_collection: z.record(z.string(), z.unknown()).nullable().optional(),
    payment_settings: z.record(z.string(), z.unknown()).nullable().optional(),
    pending_invoice_item_interval: z.record(z.string(), z.unknown()).nullable().optional(),
    pending_setup_intent: z.string().nullable().optional(),
    pending_update: z.record(z.string(), z.unknown()).nullable().optional(),
    schedule: z.string().nullable().optional(),
    start_date: z.number().optional(),
    status: z.string().optional(),
    test_clock: z.string().nullable().optional(),
    transfer_data: z.record(z.string(), z.unknown()).nullable().optional(),
    trial_end: z.number().nullable().optional(),
    trial_settings: z.record(z.string(), z.unknown()).nullable().optional(),
    trial_start: z.number().nullable().optional(),
  })
  .passthrough();

export function getSubscriptionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_get_subscription',
    description: 'Retrieve a single subscription from Stripe.',
    inputSchema: getSubscriptionInputSchema,
    outputSchema: getSubscriptionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getSubscriptionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.stripe.com/api/subscriptions/retrieve
        endpoint: `/v1/subscriptions/${encodeURIComponent(input.id)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Subscription not found',
          id: input.id,
        });
      }

      const subscription = getSubscriptionOutputSchema.parse(response.data);
      return subscription;
    },
  });
}
