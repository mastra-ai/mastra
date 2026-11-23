// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getProductInputSchema = z.object({
  id: z.string().describe('The ID of the product to retrieve. Example: "prod_xxx"'),
});

export const getProductOutputSchema = z.object({
  id: z.string(),
  object: z.literal('product'),
  active: z.boolean(),
  created: z.number(),
  default_price: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  images: z.array(z.string()).optional(),
  livemode: z.boolean(),
  marketing_features: z.array(z.object({ name: z.string() })).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  name: z.string(),
  package_dimensions: z
    .object({
      height: z.number(),
      length: z.number(),
      weight: z.number(),
      width: z.number(),
    })
    .nullable()
    .optional(),
  shippable: z.boolean().nullable().optional(),
  statement_descriptor: z.string().nullable().optional(),
  tax_code: z.string().nullable().optional(),
  unit_label: z.string().nullable().optional(),
  updated: z.number(),
  url: z.string().nullable().optional(),
});

export function getProductTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_get_product',
    description: 'Retrieve a single product from Stripe.',
    inputSchema: getProductInputSchema,
    outputSchema: getProductOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getProductOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.stripe.com/api/products/retrieve
        endpoint: `/v1/products/${encodeURIComponent(input.id)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Product not found',
          id: input.id,
        });
      }

      const product = getProductOutputSchema.parse(response.data);

      return product;
    },
  });
}
