// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getPaymentIntentInputSchema = z.object({
  intent_id: z.string().describe('Stripe PaymentIntent ID. Example: pi_3TbSonEZpD6kXrae0do5CLRX'),
});

export const getPaymentIntentOutputSchema = z
  .object({
    id: z.string(),
    object: z.literal('payment_intent'),
    amount: z.number(),
    amount_capturable: z.number().nullable().optional(),
    amount_received: z.number().nullable().optional(),
    application: z.string().nullable().optional(),
    application_fee_amount: z.number().nullable().optional(),
    automatic_payment_methods: z.record(z.string(), z.unknown()).nullable().optional(),
    canceled_at: z.number().nullable().optional(),
    cancellation_reason: z.string().nullable().optional(),
    capture_method: z.string(),
    charges: z.record(z.string(), z.unknown()).nullable().optional(),
    client_secret: z.string().nullable().optional(),
    confirmation_method: z.string(),
    created: z.number(),
    currency: z.string(),
    customer: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    invoice: z.string().nullable().optional(),
    last_payment_error: z.record(z.string(), z.unknown()).nullable().optional(),
    latest_charge: z.string().nullable().optional(),
    livemode: z.boolean(),
    metadata: z.record(z.string(), z.string()).nullable().optional(),
    next_action: z.record(z.string(), z.unknown()).nullable().optional(),
    payment_method: z.string().nullable().optional(),
    payment_method_options: z.record(z.string(), z.unknown()).nullable().optional(),
    payment_method_types: z.array(z.string()).nullable().optional(),
    processing: z.record(z.string(), z.unknown()).nullable().optional(),
    receipt_email: z.string().nullable().optional(),
    review: z.string().nullable().optional(),
    setup_future_usage: z.string().nullable().optional(),
    shipping: z.record(z.string(), z.unknown()).nullable().optional(),
    source: z.string().nullable().optional(),
    statement_descriptor: z.string().nullable().optional(),
    statement_descriptor_suffix: z.string().nullable().optional(),
    status: z.string(),
    transfer_data: z.record(z.string(), z.unknown()).nullable().optional(),
    transfer_group: z.string().nullable().optional(),
  })
  .passthrough();

export function getPaymentIntentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_get_payment_intent',
    description: 'Retrieve a single payment intent from Stripe.',
    inputSchema: getPaymentIntentInputSchema,
    outputSchema: getPaymentIntentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getPaymentIntentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.stripe.com/api/payment_intents/retrieve
        endpoint: `/v1/payment_intents/${encodeURIComponent(input.intent_id)}`,
        retries: 3,
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Payment intent not found',
          intent_id: input.intent_id,
        });
      }

      const paymentIntent = getPaymentIntentOutputSchema.parse(response.data);
      return paymentIntent;
    },
  });
}
