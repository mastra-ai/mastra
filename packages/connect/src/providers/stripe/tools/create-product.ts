// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createProductInputSchema = z.object({
  name: z.string().describe('The product name. Example: "Gold Plan"'),
  id: z.string().optional().describe('Optional unique identifier for the product. Example: "prod_xxx"'),
  active: z.boolean().optional().describe('Whether the product is available for purchase. Defaults to true.'),
  description: z.string().optional().describe('The product description. Example: "A premium plan"'),
  images: z.array(z.string()).optional().describe('Up to 8 image URLs for this product.'),
  metadata: z
    .record(z.string(), z.string())
    .optional()
    .describe('Set of key-value pairs for storing additional information.'),
  shippable: z.boolean().optional().describe('Whether this product is shipped (physical goods).'),
  statement_descriptor: z.string().optional().describe('Descriptor for customer statements. Up to 22 characters.'),
  tax_code: z.string().optional().describe('A tax code ID. Example: "txcd_xxx"'),
  unit_label: z.string().optional().describe('A label representing units of this product. Max 12 characters.'),
  url: z.string().optional().describe('A publicly-accessible webpage URL for this product.'),
});

const ProviderProductSchema = z.object({
  id: z.string(),
  object: z.string(),
  active: z.boolean(),
  created: z.number(),
  default_price: z.string().nullable(),
  description: z.string().nullable(),
  images: z.array(z.string()),
  marketing_features: z.array(z.unknown()),
  livemode: z.boolean(),
  metadata: z.record(z.string(), z.string()),
  name: z.string(),
  package_dimensions: z.unknown().nullable(),
  shippable: z.boolean().nullable(),
  statement_descriptor: z.string().nullable(),
  tax_code: z.string().nullable(),
  unit_label: z.string().nullable(),
  updated: z.number(),
  url: z.string().nullable(),
});

export const createProductOutputSchema = z.object({
  id: z.string(),
  object: z.string(),
  active: z.boolean(),
  created: z.number(),
  default_price: z.string().optional(),
  description: z.string().optional(),
  images: z.array(z.string()),
  marketing_features: z.array(z.unknown()),
  livemode: z.boolean(),
  metadata: z.record(z.string(), z.string()),
  name: z.string(),
  package_dimensions: z.unknown().optional(),
  shippable: z.boolean().optional(),
  statement_descriptor: z.string().optional(),
  tax_code: z.string().optional(),
  unit_label: z.string().optional(),
  updated: z.number(),
  url: z.string().optional(),
});

export function createProductTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_create_product',
    description: 'Create a product in Stripe.',
    inputSchema: createProductInputSchema,
    outputSchema: createProductOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createProductOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params = new URLSearchParams();
      params.append('name', input.name);

      if (input.id !== undefined) {
        params.append('id', input.id);
      }
      if (input.active !== undefined) {
        params.append('active', String(input.active));
      }
      if (input.description !== undefined) {
        params.append('description', input.description);
      }
      if (input.images !== undefined) {
        for (let i = 0; i < input.images.length; i++) {
          const image = input.images[i];
          if (image !== undefined) {
            params.append(`images[${i}]`, image);
          }
        }
      }
      if (input.metadata !== undefined) {
        for (const [key, value] of Object.entries(input.metadata)) {
          params.append(`metadata[${key}]`, value);
        }
      }
      if (input.shippable !== undefined) {
        params.append('shippable', String(input.shippable));
      }
      if (input.statement_descriptor !== undefined) {
        params.append('statement_descriptor', input.statement_descriptor);
      }
      if (input.tax_code !== undefined) {
        params.append('tax_code', input.tax_code);
      }
      if (input.unit_label !== undefined) {
        params.append('unit_label', input.unit_label);
      }
      if (input.url !== undefined) {
        params.append('url', input.url);
      }

      const response = await platformProxy.post({
        // https://docs.stripe.com/api/products/create
        endpoint: '/v1/products',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: params.toString(),
        retries: 3,
      });

      const providerProduct = ProviderProductSchema.parse(response.data);

      return {
        id: providerProduct.id,
        object: providerProduct.object,
        active: providerProduct.active,
        created: providerProduct.created,
        ...(providerProduct.default_price != null && { default_price: providerProduct.default_price }),
        ...(providerProduct.description != null && { description: providerProduct.description }),
        images: providerProduct.images,
        marketing_features: providerProduct.marketing_features,
        livemode: providerProduct.livemode,
        metadata: providerProduct.metadata,
        name: providerProduct.name,
        ...(providerProduct.package_dimensions != null && { package_dimensions: providerProduct.package_dimensions }),
        ...(providerProduct.shippable != null && { shippable: providerProduct.shippable }),
        ...(providerProduct.statement_descriptor != null && {
          statement_descriptor: providerProduct.statement_descriptor,
        }),
        ...(providerProduct.tax_code != null && { tax_code: providerProduct.tax_code }),
        ...(providerProduct.unit_label != null && { unit_label: providerProduct.unit_label }),
        updated: providerProduct.updated,
        ...(providerProduct.url != null && { url: providerProduct.url }),
      };
    },
  });
}
