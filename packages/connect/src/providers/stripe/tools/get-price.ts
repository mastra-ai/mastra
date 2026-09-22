// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getPriceInputSchema = z.object({
  id: z.string().describe('The ID of the price to retrieve. Example: "price_1MoBy5LkdIwHu7ixZhnattbh"'),
});

const RecurringSchema = z.object({
  interval: z.enum(['day', 'week', 'month', 'year']).or(z.string()),
  interval_count: z.number(),
  meter: z.string().nullable().optional(),
  usage_type: z.enum(['metered', 'licensed']).or(z.string()),
});

const TierSchema = z.object({
  flat_amount: z.number().nullable(),
  flat_amount_decimal: z.string().nullable(),
  unit_amount: z.number().nullable(),
  unit_amount_decimal: z.string().nullable(),
  up_to: z.number().nullable(),
});

const TransformQuantitySchema = z.object({
  divide_by: z.number(),
  round: z.enum(['up', 'down']).or(z.string()),
});

const CustomUnitAmountSchema = z.object({
  maximum: z.number().nullable(),
  minimum: z.number().nullable(),
  preset: z.number().nullable(),
});

export const getPriceOutputSchema = z.object({
  id: z.string(),
  object: z.string(),
  active: z.boolean(),
  billing_scheme: z.enum(['per_unit', 'tiered']).or(z.string()),
  created: z.number(),
  currency: z.string(),
  currency_options: z.record(z.string(), z.unknown()).nullable().optional(),
  custom_unit_amount: CustomUnitAmountSchema.nullable().optional(),
  livemode: z.boolean(),
  lookup_key: z.string().nullable(),
  metadata: z.record(z.string(), z.string()),
  nickname: z.string().nullable(),
  product: z.string(),
  recurring: RecurringSchema.nullable(),
  tax_behavior: z.enum(['exclusive', 'inclusive', 'unspecified']).or(z.string()).nullable(),
  tiers: z.array(TierSchema).nullable().optional(),
  tiers_mode: z.enum(['graduated', 'volume']).or(z.string()).nullable(),
  transform_quantity: TransformQuantitySchema.nullable().optional(),
  type: z.enum(['one_time', 'recurring']).or(z.string()),
  unit_amount: z.number().nullable(),
  unit_amount_decimal: z.string().nullable(),
});

export function getPriceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_get_price',
    description: 'Retrieve a single price from Stripe.',
    inputSchema: getPriceInputSchema,
    outputSchema: getPriceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getPriceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.stripe.com/api/prices/retrieve
      const response = await platformProxy.get({
        endpoint: `/v1/prices/${encodeURIComponent(input.id)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Price not found',
          id: input.id,
        });
      }

      const price = getPriceOutputSchema.parse(response.data);
      return price;
    },
  });
}
