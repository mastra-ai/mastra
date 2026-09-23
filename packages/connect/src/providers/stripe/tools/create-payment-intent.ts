// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createPaymentIntentInputSchema = z.object({
  amount: z.number().describe('Amount in smallest currency unit. Example: 2000'),
  currency: z.string().describe('Currency code. Example: "usd"'),
  customer: z.string().optional().describe('Customer ID to associate. Example: "cus_xxx"'),
  description: z.string().optional().describe('Description for the payment intent.'),
  confirm: z.boolean().optional().describe('Confirm immediately.'),
  capture_method: z.string().optional().describe('Capture method: automatic or manual.'),
  payment_method: z.string().optional().describe('Payment method ID to use. Example: "pm_xxx"'),
  receipt_email: z.string().optional().describe('Email to send receipt to.'),
  setup_future_usage: z.string().optional().describe('Set up payment method for future use.'),
  automatic_payment_methods_enabled: z.boolean().optional().describe('Enable automatic payment methods.'),
});

export const createPaymentIntentOutputSchema = z.object({
  id: z.string(),
  object: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.string(),
  client_secret: z.string().optional(),
  customer: z.string().optional(),
  description: z.string().optional(),
  created: z.number(),
  payment_method: z.string().optional(),
  capture_method: z.string().optional(),
  confirmation_method: z.string().optional(),
  setup_future_usage: z.string().optional(),
  automatic_payment_methods: z
    .object({
      enabled: z.boolean().optional(),
    })
    .optional(),
});

export function createPaymentIntentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_create_payment_intent',
    description: 'Create a payment intent in Stripe.',
    inputSchema: createPaymentIntentInputSchema,
    outputSchema: createPaymentIntentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createPaymentIntentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const body = new URLSearchParams();
      body.append('amount', String(input.amount));
      body.append('currency', input.currency);

      if (input.customer !== undefined) {
        body.append('customer', input.customer);
      }
      if (input.description !== undefined) {
        body.append('description', input.description);
      }
      if (input.confirm !== undefined) {
        body.append('confirm', String(input.confirm));
      }
      if (input.capture_method !== undefined) {
        body.append('capture_method', input.capture_method);
      }
      if (input.payment_method !== undefined) {
        body.append('payment_method', input.payment_method);
      }
      if (input.receipt_email !== undefined) {
        body.append('receipt_email', input.receipt_email);
      }
      if (input.setup_future_usage !== undefined) {
        body.append('setup_future_usage', input.setup_future_usage);
      }
      if (input.automatic_payment_methods_enabled !== undefined) {
        body.append('automatic_payment_methods[enabled]', String(input.automatic_payment_methods_enabled));
      }

      const response = await platformProxy.post({
        // https://docs.stripe.com/api/payment_intents/create
        endpoint: '/v1/payment_intents',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: body.toString(),
        retries: 3,
      });

      const providerData = z
        .object({
          id: z.string(),
          object: z.string(),
          amount: z.number(),
          currency: z.string(),
          status: z.string(),
          client_secret: z.string().optional(),
          customer: z.string().optional().nullable(),
          description: z.string().optional().nullable(),
          created: z.number(),
          payment_method: z.string().optional().nullable(),
          capture_method: z.string().optional().nullable(),
          confirmation_method: z.string().optional().nullable(),
          setup_future_usage: z.string().optional().nullable(),
          automatic_payment_methods: z
            .object({
              enabled: z.boolean().optional().nullable(),
            })
            .optional()
            .nullable(),
        })
        .parse(response.data);

      return {
        id: providerData.id,
        object: providerData.object,
        amount: providerData.amount,
        currency: providerData.currency,
        status: providerData.status,
        created: providerData.created,
        ...(providerData.client_secret !== undefined && { client_secret: providerData.client_secret }),
        ...(providerData.customer != null && { customer: providerData.customer }),
        ...(providerData.description != null && { description: providerData.description }),
        ...(providerData.payment_method != null && { payment_method: providerData.payment_method }),
        ...(providerData.capture_method != null && { capture_method: providerData.capture_method }),
        ...(providerData.confirmation_method != null && { confirmation_method: providerData.confirmation_method }),
        ...(providerData.setup_future_usage != null && { setup_future_usage: providerData.setup_future_usage }),
        ...(providerData.automatic_payment_methods != null && {
          automatic_payment_methods: {
            ...(providerData.automatic_payment_methods.enabled != null && {
              enabled: providerData.automatic_payment_methods.enabled,
            }),
          },
        }),
      };
    },
  });
}
