// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updatePaymentIntentInputSchema = z.object({
  id: z.string().describe('The ID of the PaymentIntent to update. Example: pi_xxx'),
  amount: z.number().optional().describe('Amount in the smallest currency unit. Example: 100 for $1.00'),
  currency: z.string().optional().describe('Three-letter ISO currency code. Example: usd'),
  description: z.string().nullable().optional().describe('An arbitrary string attached to the object.'),
  metadata: z.record(z.string(), z.string()).optional().describe('Set of key-value pairs to attach to the object.'),
  payment_method: z.string().nullable().optional().describe('ID of the payment method to attach.'),
  customer: z.string().nullable().optional().describe('ID of the Customer this PaymentIntent belongs to.'),
  receipt_email: z.string().nullable().optional().describe('Email address to send the receipt to.'),
});

export const updatePaymentIntentOutputSchema = z.object({
  id: z.string(),
  object: z.string(),
  amount: z.number(),
  amount_capturable: z.number(),
  amount_received: z.number(),
  application: z.string().nullable().optional(),
  application_fee_amount: z.number().nullable().optional(),
  automatic_payment_methods: z.record(z.string(), z.unknown()).nullable().optional(),
  canceled_at: z.number().nullable().optional(),
  cancellation_reason: z.string().nullable().optional(),
  capture_method: z.string(),
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
  metadata: z.record(z.string(), z.string()).optional(),
  next_action: z.record(z.string(), z.unknown()).nullable().optional(),
  on_behalf_of: z.string().nullable().optional(),
  payment_method: z.string().nullable().optional(),
  payment_method_configuration_details: z.record(z.string(), z.unknown()).nullable().optional(),
  payment_method_options: z.record(z.string(), z.unknown()).nullable().optional(),
  payment_method_types: z.array(z.string()).optional(),
  processing: z.record(z.string(), z.unknown()).nullable().optional(),
  receipt_email: z.string().nullable().optional(),
  review: z.string().nullable().optional(),
  setup_future_usage: z.string().nullable().optional(),
  shipping: z.record(z.string(), z.unknown()).nullable().optional(),
  statement_descriptor: z.string().nullable().optional(),
  statement_descriptor_suffix: z.string().nullable().optional(),
  status: z.string(),
  transfer_data: z.record(z.string(), z.unknown()).nullable().optional(),
  transfer_group: z.string().nullable().optional(),
});

export function updatePaymentIntentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_update_payment_intent',
    description: 'Update a payment intent in Stripe.',
    inputSchema: updatePaymentIntentInputSchema,
    outputSchema: updatePaymentIntentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updatePaymentIntentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const data = new URLSearchParams();
      if (input.amount !== undefined) {
        data.append('amount', String(input.amount));
      }
      if (input.currency !== undefined) {
        data.append('currency', input.currency);
      }
      if (input.description !== undefined) {
        data.append('description', input.description ?? '');
      }
      if (input.payment_method !== undefined) {
        data.append('payment_method', input.payment_method ?? '');
      }
      if (input.customer !== undefined) {
        data.append('customer', input.customer ?? '');
      }
      if (input.receipt_email !== undefined) {
        data.append('receipt_email', input.receipt_email ?? '');
      }
      if (input.metadata !== undefined) {
        for (const [key, value] of Object.entries(input.metadata)) {
          data.append(`metadata[${key}]`, value);
        }
      }

      const response = await platformProxy.post({
        // https://docs.stripe.com/api/payment_intents/update
        endpoint: `/v1/payment_intents/${encodeURIComponent(input.id)}`,
        data: data.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        retries: 10,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'PaymentIntent not found or update failed',
          intent_id: input.id,
        });
      }

      const providerPaymentIntent = updatePaymentIntentOutputSchema.parse(response.data);
      return providerPaymentIntent;
    },
  });
}
