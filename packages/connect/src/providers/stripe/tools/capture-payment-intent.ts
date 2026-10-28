// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const capturePaymentIntentInputSchema = z.object({
  id: z.string().describe('The ID of the PaymentIntent to capture. Example: pi_xxx'),
  amount_to_capture: z
    .number()
    .int()
    .optional()
    .describe('The amount to capture, in the smallest currency unit. Omit to capture the full amount.'),
  application_fee_amount: z
    .number()
    .int()
    .optional()
    .describe('The amount of the application fee to apply, in the smallest currency unit.'),
  final_capture: z.boolean().optional().describe('Whether this is the final capture. Defaults to true.'),
  statement_descriptor: z
    .string()
    .optional()
    .describe("Text that appears on the customer's statement for a non-card charge."),
  statement_descriptor_suffix: z.string().optional().describe('Suffix for the statement descriptor on a card charge.'),
});

const ProviderPaymentIntentSchema = z.object({
  id: z.string(),
  amount: z.number().int(),
  amount_capturable: z.number().int().nullable(),
  amount_received: z.number().int().nullable(),
  application_fee_amount: z.number().int().nullable(),
  canceled_at: z.number().int().nullable(),
  cancellation_reason: z.string().nullable(),
  capture_method: z.string().nullable(),
  client_secret: z.string().nullable(),
  confirmation_method: z.string().nullable(),
  created: z.number().int(),
  currency: z.string(),
  customer: z.string().nullable(),
  description: z.string().nullable(),
  latest_charge: z.string().nullable(),
  livemode: z.boolean(),
  metadata: z.object({}).passthrough().nullable(),
  next_action: z.unknown().nullable(),
  payment_method: z.string().nullable(),
  payment_method_options: z.object({}).passthrough().nullable(),
  payment_method_types: z.array(z.string()),
  receipt_email: z.string().nullable(),
  setup_future_usage: z.string().nullable(),
  shipping: z.object({}).passthrough().nullable(),
  statement_descriptor: z.string().nullable(),
  statement_descriptor_suffix: z.string().nullable(),
  status: z.string(),
  transfer_data: z.object({}).passthrough().nullable(),
  transfer_group: z.string().nullable(),
});

export const capturePaymentIntentOutputSchema = z.object({
  id: z.string(),
  amount: z.number().int(),
  amount_capturable: z.number().int().optional(),
  amount_received: z.number().int().optional(),
  application_fee_amount: z.number().int().optional(),
  canceled_at: z.number().int().optional(),
  cancellation_reason: z.string().optional(),
  capture_method: z.string().optional(),
  client_secret: z.string().optional(),
  confirmation_method: z.string().optional(),
  created: z.number().int(),
  currency: z.string(),
  customer: z.string().optional(),
  description: z.string().optional(),
  latest_charge: z.string().optional(),
  livemode: z.boolean(),
  metadata: z.object({}).passthrough().optional(),
  next_action: z.unknown().optional(),
  payment_method: z.string().optional(),
  payment_method_options: z.object({}).passthrough().optional(),
  payment_method_types: z.array(z.string()),
  receipt_email: z.string().optional(),
  setup_future_usage: z.string().optional(),
  shipping: z.object({}).passthrough().optional(),
  statement_descriptor: z.string().optional(),
  statement_descriptor_suffix: z.string().optional(),
  status: z.string(),
  transfer_data: z.object({}).passthrough().optional(),
  transfer_group: z.string().optional(),
});

export function capturePaymentIntentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_capture_payment_intent',
    description: 'Capture an uncaptured Stripe PaymentIntent.',
    inputSchema: capturePaymentIntentInputSchema,
    outputSchema: capturePaymentIntentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof capturePaymentIntentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const body = new URLSearchParams();

      if (input.amount_to_capture !== undefined) {
        body.append('amount_to_capture', String(input.amount_to_capture));
      }
      if (input.application_fee_amount !== undefined) {
        body.append('application_fee_amount', String(input.application_fee_amount));
      }
      if (input.final_capture !== undefined) {
        body.append('final_capture', String(input.final_capture));
      }
      if (input.statement_descriptor !== undefined) {
        body.append('statement_descriptor', input.statement_descriptor);
      }
      if (input.statement_descriptor_suffix !== undefined) {
        body.append('statement_descriptor_suffix', input.statement_descriptor_suffix);
      }

      const response = await platformProxy.post({
        // https://docs.stripe.com/api/payment_intents/capture
        endpoint: `/v1/payment_intents/${encodeURIComponent(input.id)}/capture`,
        data: body.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        retries: 10,
      });

      const providerPaymentIntent = ProviderPaymentIntentSchema.parse(response.data);

      return {
        id: providerPaymentIntent.id,
        amount: providerPaymentIntent.amount,
        ...(providerPaymentIntent.amount_capturable !== null && {
          amount_capturable: providerPaymentIntent.amount_capturable,
        }),
        ...(providerPaymentIntent.amount_received !== null && {
          amount_received: providerPaymentIntent.amount_received,
        }),
        ...(providerPaymentIntent.application_fee_amount !== null && {
          application_fee_amount: providerPaymentIntent.application_fee_amount,
        }),
        ...(providerPaymentIntent.canceled_at !== null && { canceled_at: providerPaymentIntent.canceled_at }),
        ...(providerPaymentIntent.cancellation_reason !== null && {
          cancellation_reason: providerPaymentIntent.cancellation_reason,
        }),
        ...(providerPaymentIntent.capture_method !== null && { capture_method: providerPaymentIntent.capture_method }),
        ...(providerPaymentIntent.client_secret !== null && { client_secret: providerPaymentIntent.client_secret }),
        ...(providerPaymentIntent.confirmation_method !== null && {
          confirmation_method: providerPaymentIntent.confirmation_method,
        }),
        created: providerPaymentIntent.created,
        currency: providerPaymentIntent.currency,
        ...(providerPaymentIntent.customer !== null && { customer: providerPaymentIntent.customer }),
        ...(providerPaymentIntent.description !== null && { description: providerPaymentIntent.description }),
        ...(providerPaymentIntent.latest_charge !== null && { latest_charge: providerPaymentIntent.latest_charge }),
        livemode: providerPaymentIntent.livemode,
        ...(providerPaymentIntent.metadata !== null && { metadata: providerPaymentIntent.metadata }),
        ...(providerPaymentIntent.next_action !== null && { next_action: providerPaymentIntent.next_action }),
        ...(providerPaymentIntent.payment_method !== null && { payment_method: providerPaymentIntent.payment_method }),
        ...(providerPaymentIntent.payment_method_options !== null && {
          payment_method_options: providerPaymentIntent.payment_method_options,
        }),
        payment_method_types: providerPaymentIntent.payment_method_types,
        ...(providerPaymentIntent.receipt_email !== null && { receipt_email: providerPaymentIntent.receipt_email }),
        ...(providerPaymentIntent.setup_future_usage !== null && {
          setup_future_usage: providerPaymentIntent.setup_future_usage,
        }),
        ...(providerPaymentIntent.shipping !== null && { shipping: providerPaymentIntent.shipping }),
        ...(providerPaymentIntent.statement_descriptor !== null && {
          statement_descriptor: providerPaymentIntent.statement_descriptor,
        }),
        ...(providerPaymentIntent.statement_descriptor_suffix !== null && {
          statement_descriptor_suffix: providerPaymentIntent.statement_descriptor_suffix,
        }),
        status: providerPaymentIntent.status,
        ...(providerPaymentIntent.transfer_data !== null && { transfer_data: providerPaymentIntent.transfer_data }),
        ...(providerPaymentIntent.transfer_group !== null && { transfer_group: providerPaymentIntent.transfer_group }),
      };
    },
  });
}
