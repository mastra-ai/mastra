// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listProductsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  limit: z.number().int().min(1).max(100).optional().describe('Maximum number of products to return. Defaults to 10.'),
  active: z.boolean().optional().describe('Filter by active status.'),
  shippable: z.boolean().optional().describe('Filter by shippable status.'),
  url: z.string().optional().describe('Filter by URL.'),
});

const ProviderProductSchema = z.object({
  id: z.string(),
  object: z.literal('product'),
  active: z.boolean().optional(),
  created: z.number().optional(),
  default_price: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  images: z.array(z.string()).optional(),
  livemode: z.boolean().optional(),
  marketing_features: z.array(z.unknown()).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  name: z.string().optional(),
  package_dimensions: z
    .object({
      height: z.number().optional(),
      length: z.number().optional(),
      weight: z.number().optional(),
      width: z.number().optional(),
    })
    .nullable()
    .optional(),
  shippable: z.boolean().nullable().optional(),
  statement_descriptor: z.string().nullable().optional(),
  tax_code: z.string().nullable().optional(),
  unit_label: z.string().nullable().optional(),
  updated: z.number().optional(),
  url: z.string().nullable().optional(),
});

const OutputProductSchema = z.object({
  id: z.string(),
  active: z.boolean().optional(),
  created: z.number().optional(),
  default_price: z.string().optional(),
  description: z.string().optional(),
  images: z.array(z.string()).optional(),
  livemode: z.boolean().optional(),
  marketing_features: z.array(z.unknown()).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  name: z.string().optional(),
  package_dimensions: z
    .object({
      height: z.number().optional(),
      length: z.number().optional(),
      weight: z.number().optional(),
      width: z.number().optional(),
    })
    .optional(),
  shippable: z.boolean().optional(),
  statement_descriptor: z.string().optional(),
  tax_code: z.string().optional(),
  unit_label: z.string().optional(),
  updated: z.number().optional(),
  url: z.string().optional(),
});

export const listProductsOutputSchema = z.object({
  items: z.array(OutputProductSchema),
  next_cursor: z.string().optional(),
});

export function listProductsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_list_products',
    description: 'List products from Stripe.',
    inputSchema: listProductsInputSchema,
    outputSchema: listProductsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listProductsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.stripe.com/api/products/list
      const response = await platformProxy.get({
        endpoint: '/v1/products',
        params: {
          ...(input.cursor && { starting_after: input.cursor }),
          ...(input.limit && { limit: String(input.limit) }),
          ...(input.active !== undefined && { active: String(input.active) }),
          ...(input.shippable !== undefined && { shippable: String(input.shippable) }),
          ...(input.url && { url: input.url }),
        },
        retries: 3,
      });

      const ProviderListSchema = z.object({
        object: z.literal('list'),
        data: z.array(ProviderProductSchema),
        has_more: z.boolean(),
        url: z.string(),
      });

      const list = ProviderListSchema.parse(response.data);

      const lastItem = list.data[list.data.length - 1];
      const nextCursor = list.has_more && lastItem ? lastItem.id : undefined;

      return {
        items: list.data.map(product => ({
          id: product.id,
          ...(product.active !== undefined && { active: product.active }),
          ...(product.created !== undefined && { created: product.created }),
          ...(product.default_price != null && { default_price: product.default_price }),
          ...(product.description != null && { description: product.description }),
          ...(product.images !== undefined && { images: product.images }),
          ...(product.livemode !== undefined && { livemode: product.livemode }),
          ...(product.marketing_features !== undefined && { marketing_features: product.marketing_features }),
          ...(product.metadata !== undefined && { metadata: product.metadata }),
          ...(product.name !== undefined && { name: product.name }),
          ...(product.package_dimensions != null && {
            package_dimensions: {
              ...(product.package_dimensions.height !== undefined && { height: product.package_dimensions.height }),
              ...(product.package_dimensions.length !== undefined && { length: product.package_dimensions.length }),
              ...(product.package_dimensions.weight !== undefined && { weight: product.package_dimensions.weight }),
              ...(product.package_dimensions.width !== undefined && { width: product.package_dimensions.width }),
            },
          }),
          ...(product.shippable != null && { shippable: product.shippable }),
          ...(product.statement_descriptor != null && { statement_descriptor: product.statement_descriptor }),
          ...(product.tax_code != null && { tax_code: product.tax_code }),
          ...(product.unit_label != null && { unit_label: product.unit_label }),
          ...(product.updated !== undefined && { updated: product.updated }),
          ...(product.url != null && { url: product.url }),
        })),
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      };
    },
  });
}
