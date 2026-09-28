// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getCustomerInputSchema = z.object({
  id: z.string().describe('The ID of the customer to retrieve. Example: "cus_123"'),
});

const AddressSchema = z
  .object({
    city: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    line1: z.string().nullable().optional(),
    line2: z.string().nullable().optional(),
    postal_code: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
  })
  .passthrough();

const InvoiceSettingsSchema = z
  .object({
    custom_fields: z
      .array(
        z.object({
          name: z.string(),
          value: z.string(),
        }),
      )
      .nullable()
      .optional(),
    default_payment_method: z.string().nullable().optional(),
    footer: z.string().nullable().optional(),
    rendering_options: z.unknown().nullable().optional(),
  })
  .passthrough();

const ShippingSchema = z
  .object({
    address: AddressSchema.nullable().optional(),
    name: z.string().optional(),
    phone: z.string().nullable().optional(),
  })
  .passthrough();

export const getCustomerOutputSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    address: AddressSchema.nullable().optional(),
    balance: z.number().optional(),
    created: z.number().optional(),
    currency: z.string().nullable().optional(),
    default_source: z.string().nullable().optional(),
    delinquent: z.boolean().nullable().optional(),
    description: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    invoice_settings: InvoiceSettingsSchema.optional(),
    livemode: z.boolean().optional(),
    metadata: z.record(z.string(), z.string()).optional(),
    name: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    preferred_locales: z.array(z.string()).nullable().optional(),
    shipping: ShippingSchema.nullable().optional(),
  })
  .passthrough();

export function getCustomerTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_get_customer',
    description: 'Retrieve a single customer from Stripe.',
    inputSchema: getCustomerInputSchema,
    outputSchema: getCustomerOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getCustomerOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.stripe.com/api/customers/retrieve
        endpoint: `/v1/customers/${encodeURIComponent(input.id)}`,
        retries: 3,
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Customer not found',
          id: input.id,
        });
      }

      const customer = getCustomerOutputSchema.parse(response.data);
      return customer;
    },
  });
}
