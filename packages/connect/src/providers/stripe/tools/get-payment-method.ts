// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getPaymentMethodInputSchema = z.object({
  payment_method: z.string().describe('Payment method ID. Example: "pm_1Q0PsIJvEtkwdCNYMSaVuRz6"'),
});

const BillingDetailsAddressSchema = z.object({
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  line1: z.string().nullable().optional(),
  line2: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
});

const BillingDetailsSchema = z.object({
  address: BillingDetailsAddressSchema.nullable().optional(),
  email: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  tax_id: z.string().nullable().optional(),
});

export const getPaymentMethodOutputSchema = z
  .object({
    id: z.string(),
    object: z.string(),
    allow_redisplay: z.enum(['always', 'limited', 'unspecified']).or(z.string()).nullable().optional(),
    billing_details: BillingDetailsSchema.optional(),
    created: z.number(),
    customer: z.string().nullable().optional(),
    livemode: z.boolean(),
    metadata: z.record(z.string(), z.string()).nullable().optional(),
    type: z.string(),
  })
  .passthrough();

export function getPaymentMethodTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_get_payment_method',
    description: 'Retrieve a single payment method from Stripe.',
    inputSchema: getPaymentMethodInputSchema,
    outputSchema: getPaymentMethodOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getPaymentMethodOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.stripe.com/api/payment_methods/retrieve
        endpoint: `/v1/payment_methods/${encodeURIComponent(input.payment_method)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Payment method not found',
          payment_method: input.payment_method,
        });
      }

      const paymentMethod = getPaymentMethodOutputSchema.parse(response.data);

      return paymentMethod;
    },
  });
}
