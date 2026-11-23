// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deletePaymentIntentInputSchema = z.object({
  payment_intent_id: z
    .string()
    .describe('The ID of the PaymentIntent to cancel. Example: "pi_3TbSopEZpD6kXrae1ZIp2rzC"'),
});

const ProviderPaymentIntentSchema = z.object({
  id: z.string(),
  object: z.string(),
  amount: z.number().optional(),
  amount_capturable: z.number().optional(),
  amount_received: z.number().optional(),
  canceled_at: z.number().nullable().optional(),
  cancellation_reason: z.string().nullable().optional(),
  capture_method: z.string().optional(),
  client_secret: z.string().nullable().optional(),
  confirmation_method: z.string().optional(),
  created: z.number().optional(),
  currency: z.string().optional(),
  customer: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  latest_charge: z.string().nullable().optional(),
  livemode: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  payment_method: z.string().nullable().optional(),
  receipt_email: z.string().nullable().optional(),
  status: z.string(),
  transfer_group: z.string().nullable().optional(),
});

export const deletePaymentIntentOutputSchema = z.object({
  id: z.string(),
  status: z.string(),
  canceled_at: z.number().optional(),
  cancellation_reason: z.string().optional(),
});

export function deletePaymentIntentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_delete_payment_intent',
    description: 'Cancel a Stripe PaymentIntent.',
    inputSchema: deletePaymentIntentInputSchema,
    outputSchema: deletePaymentIntentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deletePaymentIntentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.stripe.com/api/payment_intents/cancel
        endpoint: `/v1/payment_intents/${encodeURIComponent(input.payment_intent_id)}/cancel`,
        retries: 3,
      });

      const providerPaymentIntent = ProviderPaymentIntentSchema.parse(response.data);

      return {
        id: providerPaymentIntent.id,
        status: providerPaymentIntent.status,
        ...(providerPaymentIntent.canceled_at != null && { canceled_at: providerPaymentIntent.canceled_at }),
        ...(providerPaymentIntent.cancellation_reason != null && {
          cancellation_reason: providerPaymentIntent.cancellation_reason,
        }),
      };
    },
  });
}
