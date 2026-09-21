// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const cancelPaymentIntentInputSchema = z.object({
  id: z.string().describe('PaymentIntent ID to cancel. Example: pi_xxx'),
  cancellation_reason: z
    .string()
    .optional()
    .describe('Reason for cancellation. Example: duplicate, fraudulent, requested_by_customer, abandoned'),
});

const ProviderPaymentIntentSchema = z
  .object({
    id: z.string(),
    amount: z.number(),
    currency: z.string(),
    status: z.string(),
    cancellation_reason: z.string().nullable().optional(),
    client_secret: z.string().nullable().optional(),
    created: z.number(),
    description: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.string()).nullable().optional(),
  })
  .passthrough();

export const cancelPaymentIntentOutputSchema = z.object({
  id: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.string(),
  cancellation_reason: z.string().optional(),
  client_secret: z.string().optional(),
  created: z.number(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export function cancelPaymentIntentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_cancel_payment_intent',
    description: 'Cancel a Stripe PaymentIntent.',
    inputSchema: cancelPaymentIntentInputSchema,
    outputSchema: cancelPaymentIntentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof cancelPaymentIntentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.stripe.com/api/payment_intents/cancel
        endpoint: `/v1/payment_intents/${encodeURIComponent(input.id)}/cancel`,
        data: {
          ...(input.cancellation_reason !== undefined && { cancellation_reason: input.cancellation_reason }),
        },
        retries: 3,
      });

      const paymentIntent = ProviderPaymentIntentSchema.parse(response.data);

      return {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        ...(paymentIntent.cancellation_reason != null && { cancellation_reason: paymentIntent.cancellation_reason }),
        ...(paymentIntent.client_secret != null && { client_secret: paymentIntent.client_secret }),
        created: paymentIntent.created,
        ...(paymentIntent.description != null && { description: paymentIntent.description }),
        ...(paymentIntent.metadata != null && { metadata: paymentIntent.metadata }),
      };
    },
  });
}
