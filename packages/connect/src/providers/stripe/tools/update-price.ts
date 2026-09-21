// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const updatePriceInputSchema = z.object({
  id: z.string().describe('The ID of the price to update. Example: "price_1TbSoBEZpD6kXraeE9F1XSiB"'),
  active: z.boolean().optional().describe('Whether the price can be used for new purchases.'),
  metadata: z.record(z.string(), z.string()).optional().describe('A set of key-value pairs to attach to the price.'),
  nickname: z.string().optional().describe('A brief description of the price, hidden from customers.'),
  tax_behavior: z
    .enum(['exclusive', 'inclusive', 'unspecified'])
    .optional()
    .describe('Specifies whether the price is considered inclusive or exclusive of tax.'),
});

export const updatePriceOutputSchema = z
  .object({
    id: z.string(),
    object: z.string(),
    active: z.boolean(),
    billing_scheme: z.string(),
    created: z.number(),
    currency: z.string(),
    custom_unit_amount: z.record(z.string(), z.unknown()).nullable().optional(),
    livemode: z.boolean(),
    lookup_key: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.string()).optional(),
    nickname: z.string().nullable().optional(),
    product: z.string(),
    recurring: z.record(z.string(), z.unknown()).nullable().optional(),
    tax_behavior: z.string().nullable().optional(),
    tiers: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
    tiers_mode: z.string().nullable().optional(),
    transform_quantity: z.record(z.string(), z.unknown()).nullable().optional(),
    type: z.string(),
    unit_amount: z.number().nullable().optional(),
    unit_amount_decimal: z.string().nullable().optional(),
  })
  .passthrough();

export function updatePriceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_update_price',
    description: 'Update a price in Stripe.',
    inputSchema: updatePriceInputSchema,
    outputSchema: updatePriceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updatePriceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const updateData: Record<string, unknown> = {
        ...(input.active !== undefined && { active: input.active }),
        ...(input.metadata !== undefined && { metadata: input.metadata }),
        ...(input.nickname !== undefined && { nickname: input.nickname }),
        ...(input.tax_behavior !== undefined && { tax_behavior: input.tax_behavior }),
      };

      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined && value !== null) {
          if (typeof value === 'object' && !Array.isArray(value)) {
            for (const [nestedKey, nestedValue] of Object.entries(value)) {
              if (nestedValue !== undefined && nestedValue !== null) {
                params.append(`${key}[${nestedKey}]`, String(nestedValue));
              }
            }
          } else {
            params.append(key, String(value));
          }
        }
      }

      const proxyConfig: PlatformProxyRequest = {
        // https://docs.stripe.com/api/prices/update
        endpoint: `/v1/prices/${encodeURIComponent(input.id)}`,
        data: params.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        retries: 3,
      };

      const response = await platformProxy.post(proxyConfig);

      const price = updatePriceOutputSchema.parse(response.data);

      return price;
    },
  });
}
