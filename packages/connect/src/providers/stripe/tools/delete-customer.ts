// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteCustomerInputSchema = z.object({
  id: z.string().describe('Stripe Customer ID. Example: "cus_123"'),
});

const ProviderResponseSchema = z.object({
  id: z.string(),
  object: z.string().optional(),
  deleted: z.boolean().optional(),
});

export const deleteCustomerOutputSchema = z.object({
  id: z.string(),
  deleted: z.boolean().optional(),
});

export function deleteCustomerTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_delete_customer',
    description: 'Delete or archive a customer in Stripe.',
    inputSchema: deleteCustomerInputSchema,
    outputSchema: deleteCustomerOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteCustomerOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.delete({
        // https://docs.stripe.com/api/customers/delete
        endpoint: `/v1/customers/${encodeURIComponent(input.id)}`,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        id: providerResponse.id,
        ...(providerResponse.deleted !== undefined && { deleted: providerResponse.deleted }),
      };
    },
  });
}
