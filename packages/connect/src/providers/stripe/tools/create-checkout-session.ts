// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const LineItemSchema = z.object({
  price: z.string().describe('The ID of the Price object. Example: "price_1TbSoBEZpD6kXraeE9F1XSiB"'),
  quantity: z.number().int().describe('The quantity of the line item being purchased. Example: 1'),
});

export const createCheckoutSessionInputSchema = z.object({
  mode: z.enum(['payment', 'setup', 'subscription']).describe('The mode of the Checkout Session. Example: "payment"'),
  success_url: z
    .string()
    .optional()
    .describe('URL to redirect the customer to after a successful payment. Example: "https://example.com/success"'),
  cancel_url: z
    .string()
    .optional()
    .describe('URL to redirect the customer to if they cancel the payment. Example: "https://example.com/cancel"'),
  customer: z.string().optional().describe('ID of an existing Customer. Example: "cus_Uae6TTxHlP2hxk"'),
  customer_email: z
    .string()
    .optional()
    .describe('Email address to prefill in Checkout. Example: "customer@example.com"'),
  currency: z.string().optional().describe('Three-letter ISO currency code. Example: "usd"'),
  line_items: z.array(LineItemSchema).optional().describe('A list of items the customer is purchasing.'),
  metadata: z.record(z.string(), z.string()).optional().describe('Set of key-value pairs to attach to the session.'),
});

const ProviderCheckoutSessionSchema = z.object({
  id: z.string(),
  object: z.string(),
  amount_subtotal: z.number().int().nullable(),
  amount_total: z.number().int().nullable(),
  currency: z.string().nullable(),
  customer: z.string().nullable(),
  customer_email: z.string().nullable(),
  mode: z.string(),
  status: z.string().nullable(),
  url: z.string().nullable(),
  cancel_url: z.string().nullable(),
  success_url: z.string().nullable(),
  created: z.number().int(),
  expires_at: z.number().int().nullable(),
  payment_intent: z.string().nullable(),
  subscription: z.string().nullable(),
  client_secret: z.string().nullable(),
  metadata: z.record(z.string(), z.string()).nullable(),
});

export const createCheckoutSessionOutputSchema = z.object({
  id: z.string(),
  mode: z.string(),
  created: z.number().int(),
  amount_subtotal: z.number().int().optional(),
  amount_total: z.number().int().optional(),
  currency: z.string().optional(),
  customer: z.string().optional(),
  customer_email: z.string().optional(),
  status: z.string().optional(),
  url: z.string().optional(),
  cancel_url: z.string().optional(),
  success_url: z.string().optional(),
  expires_at: z.number().int().optional(),
  payment_intent: z.string().optional(),
  subscription: z.string().optional(),
  client_secret: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export function createCheckoutSessionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_create_checkout_session',
    description: 'Create a checkout session in Stripe.',
    inputSchema: createCheckoutSessionInputSchema,
    outputSchema: createCheckoutSessionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createCheckoutSessionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const pairs: string[] = [];
      pairs.push(`mode=${encodeURIComponent(input.mode)}`);

      if (input.success_url !== undefined) {
        pairs.push(`success_url=${encodeURIComponent(input.success_url)}`);
      }
      if (input.cancel_url !== undefined) {
        pairs.push(`cancel_url=${encodeURIComponent(input.cancel_url)}`);
      }
      if (input.customer !== undefined) {
        pairs.push(`customer=${encodeURIComponent(input.customer)}`);
      }
      if (input.customer_email !== undefined) {
        pairs.push(`customer_email=${encodeURIComponent(input.customer_email)}`);
      }
      if (input.currency !== undefined) {
        pairs.push(`currency=${encodeURIComponent(input.currency)}`);
      }

      if (input.line_items !== undefined) {
        for (let i = 0; i < input.line_items.length; i++) {
          const item = input.line_items[i];
          if (item === undefined) {
            continue;
          }
          pairs.push(`line_items[${i}][price]=${encodeURIComponent(item.price)}`);
          pairs.push(`line_items[${i}][quantity]=${encodeURIComponent(String(item.quantity))}`);
        }
      }

      if (input.metadata !== undefined) {
        for (const [key, value] of Object.entries(input.metadata)) {
          pairs.push(`metadata[${encodeURIComponent(key)}]=${encodeURIComponent(value)}`);
        }
      }

      const formData = pairs.join('&');

      // https://docs.stripe.com/api/checkout/sessions/create
      const response = await platformProxy.post({
        endpoint: '/v1/checkout/sessions',
        data: formData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        retries: 10,
      });

      const providerSession = ProviderCheckoutSessionSchema.parse(response.data);

      return {
        id: providerSession.id,
        mode: providerSession.mode,
        created: providerSession.created,
        ...(providerSession.amount_subtotal != null && { amount_subtotal: providerSession.amount_subtotal }),
        ...(providerSession.amount_total != null && { amount_total: providerSession.amount_total }),
        ...(providerSession.currency != null && { currency: providerSession.currency }),
        ...(providerSession.customer != null && { customer: providerSession.customer }),
        ...(providerSession.customer_email != null && { customer_email: providerSession.customer_email }),
        ...(providerSession.status != null && { status: providerSession.status }),
        ...(providerSession.url != null && { url: providerSession.url }),
        ...(providerSession.cancel_url != null && { cancel_url: providerSession.cancel_url }),
        ...(providerSession.success_url != null && { success_url: providerSession.success_url }),
        ...(providerSession.expires_at != null && { expires_at: providerSession.expires_at }),
        ...(providerSession.payment_intent != null && { payment_intent: providerSession.payment_intent }),
        ...(providerSession.subscription != null && { subscription: providerSession.subscription }),
        ...(providerSession.client_secret != null && { client_secret: providerSession.client_secret }),
        ...(providerSession.metadata != null && { metadata: providerSession.metadata }),
      };
    },
  });
}
