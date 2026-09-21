// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateCustomerInputSchema = z.object({
  id: z.string().describe('The ID of the customer to update. Example: cus_123'),
  name: z.string().optional().describe("The customer's full name."),
  email: z.string().optional().describe("The customer's email address."),
  phone: z.string().optional().describe("The customer's phone number."),
  description: z.string().optional().describe('An arbitrary string attached to the object.'),
  address: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postal_code: z.string().optional(),
      country: z.string().optional(),
    })
    .optional()
    .describe("The customer's address."),
  metadata: z.record(z.string(), z.string()).optional().describe('Set of key-value pairs for metadata.'),
});

const ProviderCustomerSchema = z.object({
  id: z.string(),
  object: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  created: z.number(),
  metadata: z.record(z.string(), z.string()).nullable().optional(),
});

export const updateCustomerOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  description: z.string().optional(),
  created: z.number().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export function updateCustomerTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_update_customer',
    description: 'Update a customer in Stripe.',
    inputSchema: updateCustomerInputSchema,
    outputSchema: updateCustomerOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateCustomerOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params = new URLSearchParams();

      if (input.name !== undefined) {
        params.append('name', input.name);
      }
      if (input.email !== undefined) {
        params.append('email', input.email);
      }
      if (input.phone !== undefined) {
        params.append('phone', input.phone);
      }
      if (input.description !== undefined) {
        params.append('description', input.description);
      }
      if (input.address !== undefined) {
        if (input.address.line1 !== undefined) {
          params.append('address[line1]', input.address.line1);
        }
        if (input.address.line2 !== undefined) {
          params.append('address[line2]', input.address.line2);
        }
        if (input.address.city !== undefined) {
          params.append('address[city]', input.address.city);
        }
        if (input.address.state !== undefined) {
          params.append('address[state]', input.address.state);
        }
        if (input.address.postal_code !== undefined) {
          params.append('address[postal_code]', input.address.postal_code);
        }
        if (input.address.country !== undefined) {
          params.append('address[country]', input.address.country);
        }
      }
      if (input.metadata !== undefined) {
        for (const [key, value] of Object.entries(input.metadata)) {
          params.append(`metadata[${key}]`, value);
        }
      }

      // https://docs.stripe.com/api/customers/update
      const response = await platformProxy.post({
        endpoint: `/v1/customers/${encodeURIComponent(input.id)}`,
        data: params.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        retries: 3,
      });

      const providerCustomer = ProviderCustomerSchema.parse(response.data);

      return {
        id: providerCustomer.id,
        ...(providerCustomer.name != null && { name: providerCustomer.name }),
        ...(providerCustomer.email != null && { email: providerCustomer.email }),
        ...(providerCustomer.phone != null && { phone: providerCustomer.phone }),
        ...(providerCustomer.description != null && { description: providerCustomer.description }),
        ...(providerCustomer.created != null && { created: providerCustomer.created }),
        ...(providerCustomer.metadata != null && { metadata: providerCustomer.metadata }),
      };
    },
  });
}
