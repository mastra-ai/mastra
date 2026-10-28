// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getCheckoutSessionInputSchema = z.object({
  session_id: z.string().describe('Checkout Session ID. Example: "cs_test_..."'),
});

const CheckoutSessionSchema = z
  .object({
    id: z.string(),
    object: z.string(),
    after_expiration: z.unknown().nullable().optional(),
    allow_promotion_codes: z.boolean().nullable().optional(),
    amount_subtotal: z.number().nullable().optional(),
    amount_total: z.number().nullable().optional(),
    automatic_tax: z
      .object({
        enabled: z.boolean(),
        liability: z.unknown().nullable().optional(),
        status: z.unknown().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    billing_address_collection: z.string().nullable().optional(),
    cancel_url: z.string().nullable().optional(),
    client_reference_id: z.string().nullable().optional(),
    consent: z.unknown().nullable().optional(),
    consent_collection: z.unknown().nullable().optional(),
    created: z.number(),
    currency: z.string().nullable().optional(),
    custom_fields: z.array(z.unknown()).optional(),
    custom_text: z
      .object({
        shipping_address: z.unknown().nullable().optional(),
        submit: z.unknown().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    customer: z.string().nullable().optional(),
    customer_creation: z.string().nullable().optional(),
    customer_details: z.unknown().nullable().optional(),
    customer_email: z.string().nullable().optional(),
    expires_at: z.number().nullable().optional(),
    invoice: z.string().nullable().optional(),
    invoice_creation: z
      .object({
        enabled: z.boolean(),
        invoice_data: z.record(z.string(), z.unknown()).nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    livemode: z.boolean(),
    locale: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    mode: z.string(),
    payment_intent: z.string().nullable().optional(),
    payment_link: z.string().nullable().optional(),
    payment_method_collection: z.string().nullable().optional(),
    payment_method_options: z.record(z.string(), z.unknown()).optional(),
    payment_method_types: z.array(z.string()).optional(),
    payment_status: z.string(),
    phone_number_collection: z
      .object({
        enabled: z.boolean(),
      })
      .passthrough()
      .nullable()
      .optional(),
    recovered_from: z.string().nullable().optional(),
    setup_intent: z.string().nullable().optional(),
    shipping_address_collection: z.unknown().nullable().optional(),
    shipping_cost: z.unknown().nullable().optional(),
    shipping_details: z.unknown().nullable().optional(),
    shipping_options: z.array(z.unknown()).optional(),
    status: z.string(),
    submit_type: z.string().nullable().optional(),
    subscription: z.string().nullable().optional(),
    success_url: z.string().nullable().optional(),
    total_details: z
      .object({
        amount_discount: z.number(),
        amount_shipping: z.number(),
        amount_tax: z.number(),
      })
      .passthrough()
      .nullable()
      .optional(),
    url: z.string().nullable().optional(),
  })
  .passthrough();

export const getCheckoutSessionOutputSchema = CheckoutSessionSchema;

export function getCheckoutSessionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_get_checkout_session',
    description: 'Retrieve a single checkout session from Stripe.',
    inputSchema: getCheckoutSessionInputSchema,
    outputSchema: getCheckoutSessionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getCheckoutSessionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.stripe.com/api/checkout/sessions/retrieve
        endpoint: `/v1/checkout/sessions/${encodeURIComponent(input.session_id)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Checkout session not found',
          session_id: input.session_id,
        });
      }

      const session = CheckoutSessionSchema.parse(response.data);

      return session;
    },
  });
}
