// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deletePriceInputSchema = z.object({
  id: z.string().describe('The ID of the price to archive. Example: "price_1TbSoBEZpD6kXraeE9F1XSiB"'),
});

const ProviderPriceSchema = z.object({
  id: z.string(),
  object: z.literal('price'),
  active: z.boolean(),
});

export const deletePriceOutputSchema = z.object({
  id: z.string(),
  object: z.literal('price'),
  active: z.boolean(),
});

export function deletePriceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_delete_price',
    description: 'Archive a price in Stripe.',
    inputSchema: deletePriceInputSchema,
    outputSchema: deletePriceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deletePriceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.stripe.com/api/prices/update
        endpoint: `/v1/prices/${encodeURIComponent(input.id)}`,
        data: 'active=false',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        retries: 3,
      });

      const providerPrice = ProviderPriceSchema.parse(response.data);

      return {
        id: providerPrice.id,
        object: providerPrice.object,
        active: providerPrice.active,
      };
    },
  });
}
