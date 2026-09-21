// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function flattenObject(obj: unknown, prefix: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (obj === null || obj === undefined) {
    return result;
  }
  if (typeof obj === 'boolean' || typeof obj === 'number' || typeof obj === 'string') {
    result[prefix] = String(obj);
    return result;
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const nested = flattenObject(obj[i], `${prefix}[${i}]`);
      Object.assign(result, nested);
    }
    return result;
  }
  if (isRecord(obj)) {
    for (const key of Object.keys(obj)) {
      const newPrefix = prefix ? `${prefix}[${key}]` : key;
      const nested = flattenObject(obj[key], newPrefix);
      Object.assign(result, nested);
    }
    return result;
  }
  return result;
}

const MarketingFeatureSchema = z.object({
  name: z.string(),
});

const PackageDimensionsSchema = z.object({
  height: z.number(),
  length: z.number(),
  weight: z.number(),
  width: z.number(),
});

const TaxDetailsSchema = z.object({
  performance_location: z.string().optional(),
  tax_code: z.string().optional(),
});

export const updateProductInputSchema = z.object({
  id: z.string().describe('Product ID. Example: "prod_xxx"'),
  active: z.boolean().optional(),
  default_price: z.string().optional(),
  description: z.string().optional(),
  images: z.array(z.string()).optional(),
  marketing_features: z.array(MarketingFeatureSchema).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  name: z.string().optional(),
  package_dimensions: PackageDimensionsSchema.optional(),
  shippable: z.boolean().optional(),
  statement_descriptor: z.string().optional(),
  tax_code: z.string().optional(),
  tax_details: TaxDetailsSchema.optional(),
  unit_label: z.string().optional(),
  url: z.string().optional(),
});

export const updateProductOutputSchema = z.object({
  id: z.string(),
  object: z.string(),
  active: z.boolean().optional(),
  created: z.number().optional(),
  default_price: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  images: z.array(z.string()).optional(),
  marketing_features: z.array(MarketingFeatureSchema).optional(),
  livemode: z.boolean().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  name: z.string().optional(),
  package_dimensions: PackageDimensionsSchema.nullable().optional(),
  shippable: z.boolean().nullable().optional(),
  statement_descriptor: z.string().nullable().optional(),
  tax_code: z.string().nullable().optional(),
  unit_label: z.string().nullable().optional(),
  updated: z.number().optional(),
  url: z.string().nullable().optional(),
});

export function updateProductTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_update_product',
    description: 'Update a product in Stripe',
    inputSchema: updateProductInputSchema,
    outputSchema: updateProductOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateProductOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const payload: Record<string, unknown> = {};
      if (input.active !== undefined) {
        payload['active'] = input.active;
      }
      if (input.default_price !== undefined) {
        payload['default_price'] = input.default_price;
      }
      if (input.description !== undefined) {
        payload['description'] = input.description;
      }
      if (input.images !== undefined) {
        payload['images'] = input.images;
      }
      if (input.marketing_features !== undefined) {
        payload['marketing_features'] = input.marketing_features;
      }
      if (input.metadata !== undefined) {
        payload['metadata'] = input.metadata;
      }
      if (input.name !== undefined) {
        payload['name'] = input.name;
      }
      if (input.package_dimensions !== undefined) {
        payload['package_dimensions'] = input.package_dimensions;
      }
      if (input.shippable !== undefined) {
        payload['shippable'] = input.shippable;
      }
      if (input.statement_descriptor !== undefined) {
        payload['statement_descriptor'] = input.statement_descriptor;
      }
      if (input.tax_code !== undefined) {
        payload['tax_code'] = input.tax_code;
      }
      if (input.tax_details !== undefined) {
        payload['tax_details'] = input.tax_details;
      }
      if (input.unit_label !== undefined) {
        payload['unit_label'] = input.unit_label;
      }
      if (input.url !== undefined) {
        payload['url'] = input.url;
      }

      const response = await platformProxy.post({
        // https://docs.stripe.com/api/products/update
        endpoint: `/v1/products/${encodeURIComponent(input.id)}`,
        data: new URLSearchParams(flattenObject(payload, '')).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        retries: 3,
      });

      const providerProduct = updateProductOutputSchema.parse(response.data);
      return providerProduct;
    },
  });
}
