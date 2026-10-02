// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const AddressSchema = z.object({
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
});

export const createCustomerInputSchema = z.object({
  email: z.string().email().optional().describe('Customer email address. Example: "customer@example.com"'),
  name: z.string().optional().describe('Customer full name. Example: "Jane Doe"'),
  description: z.string().optional().describe('An arbitrary string attached to the object. Example: "Enterprise plan"'),
  phone: z.string().optional().describe('Customer phone number. Example: "+1-555-555-5555"'),
  address: AddressSchema.optional(),
  metadata: z
    .record(z.string(), z.string())
    .optional()
    .describe('Set of key-value pairs for storing additional information.'),
});

const ProviderCustomerSchema = z.object({
  id: z.string(),
  object: z.string().optional(),
  address: AddressSchema.nullable().optional(),
  created: z.number().optional(),
  currency: z.string().nullable().optional(),
  default_source: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  invoice_prefix: z.string().optional(),
  livemode: z.boolean().optional(),
  metadata: z.record(z.string(), z.string()).nullable().optional(),
  name: z.string().nullable().optional(),
  next_invoice_sequence: z.number().optional(),
  phone: z.string().nullable().optional(),
  preferred_locales: z.array(z.string()).nullable().optional(),
  shipping: z.unknown().nullable().optional(),
  tax_exempt: z.string().nullable().optional(),
});

export const createCustomerOutputSchema = z.object({
  id: z.string(),
  address: AddressSchema.optional(),
  created: z.number().optional(),
  currency: z.string().optional(),
  default_source: z.string().optional(),
  description: z.string().optional(),
  email: z.string().optional(),
  invoice_prefix: z.string().optional(),
  livemode: z.boolean().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  name: z.string().optional(),
  next_invoice_sequence: z.number().optional(),
  phone: z.string().optional(),
  preferred_locales: z.array(z.string()).optional(),
  shipping: z.unknown().optional(),
  tax_exempt: z.string().optional(),
});

export function createCustomerTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_create_customer',
    description: 'Create a customer in Stripe.',
    inputSchema: createCustomerInputSchema,
    outputSchema: createCustomerOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createCustomerOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const data: Record<string, string> = {
        ...(input.email !== undefined && { email: input.email }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.address !== undefined && {
          ...(input.address.line1 !== undefined && { 'address[line1]': input.address.line1 }),
          ...(input.address.line2 !== undefined && { 'address[line2]': input.address.line2 }),
          ...(input.address.city !== undefined && { 'address[city]': input.address.city }),
          ...(input.address.state !== undefined && { 'address[state]': input.address.state }),
          ...(input.address.postal_code !== undefined && { 'address[postal_code]': input.address.postal_code }),
          ...(input.address.country !== undefined && { 'address[country]': input.address.country }),
        }),
        ...(input.metadata !== undefined &&
          Object.fromEntries(Object.entries(input.metadata).map(([k, v]) => [`metadata[${k}]`, v]))),
      };

      const response = await platformProxy.post({
        // https://docs.stripe.com/api/customers/create
        endpoint: '/v1/customers',
        data: new URLSearchParams(data).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        retries: 1,
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Stripe API',
        });
      }

      const providerCustomer = ProviderCustomerSchema.parse(response.data);

      return {
        id: providerCustomer.id,
        ...(providerCustomer.address != null && { address: providerCustomer.address }),
        ...(providerCustomer.created !== undefined && { created: providerCustomer.created }),
        ...(providerCustomer.currency != null && { currency: providerCustomer.currency }),
        ...(providerCustomer.default_source != null && { default_source: providerCustomer.default_source }),
        ...(providerCustomer.description != null && { description: providerCustomer.description }),
        ...(providerCustomer.email != null && { email: providerCustomer.email }),
        ...(providerCustomer.invoice_prefix !== undefined && { invoice_prefix: providerCustomer.invoice_prefix }),
        ...(providerCustomer.livemode !== undefined && { livemode: providerCustomer.livemode }),
        ...(providerCustomer.metadata != null && { metadata: providerCustomer.metadata }),
        ...(providerCustomer.name != null && { name: providerCustomer.name }),
        ...(providerCustomer.next_invoice_sequence !== undefined && {
          next_invoice_sequence: providerCustomer.next_invoice_sequence,
        }),
        ...(providerCustomer.phone != null && { phone: providerCustomer.phone }),
        ...(providerCustomer.preferred_locales != null && { preferred_locales: providerCustomer.preferred_locales }),
        ...(providerCustomer.shipping != null && { shipping: providerCustomer.shipping }),
        ...(providerCustomer.tax_exempt != null && { tax_exempt: providerCustomer.tax_exempt }),
      };
    },
  });
}
