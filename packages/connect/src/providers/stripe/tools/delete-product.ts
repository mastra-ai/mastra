// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteProductInputSchema = z.object({
  id: z.string().describe('Product ID. Example: "prod_xxx"'),
});

const ProviderProductSchema = z.object({
  id: z.string(),
  deleted: z.boolean(),
  object: z.string().optional(),
});

export const deleteProductOutputSchema = z.object({
  id: z.string(),
  deleted: z.boolean(),
});

export function deleteProductTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_delete_product',
    description: 'Delete or archive a product in Stripe.',
    inputSchema: deleteProductInputSchema,
    outputSchema: deleteProductOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteProductOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.delete({
        // https://docs.stripe.com/api/products/delete
        endpoint: `/v1/products/${encodeURIComponent(input.id)}`,
        retries: 3,
      });

      const providerProduct = ProviderProductSchema.parse(response.data);

      return {
        id: providerProduct.id,
        deleted: providerProduct.deleted,
      };
    },
  });
}
