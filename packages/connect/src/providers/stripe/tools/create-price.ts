// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createPriceInputSchema = z.object({
  currency: z.string().describe('Three-letter ISO currency code. Example: "usd"'),
  unit_amount: z
    .number()
    .optional()
    .describe('A positive integer in the smallest currency unit (or 0 for a free price). Example: 1000'),
  unit_amount_decimal: z
    .string()
    .optional()
    .describe('Same as unit_amount, but accepts a decimal value in the smallest currency unit. Example: "10.00"'),
  custom_unit_amount: z
    .object({
      enabled: z.boolean(),
      maximum: z.number().optional(),
      minimum: z.number().optional(),
      preset: z.number().optional(),
    })
    .optional(),
  product: z.string().optional().describe('The ID of the Product this Price will belong to. Example: "prod_xxx"'),
  product_data: z
    .object({
      name: z.string(),
      active: z.boolean().optional(),
      metadata: z.record(z.string(), z.string()).optional(),
      statement_descriptor: z.string().optional(),
      tax_code: z.string().optional(),
      unit_label: z.string().optional(),
    })
    .optional(),
  recurring: z
    .object({
      interval: z.enum(['day', 'week', 'month', 'year']),
      interval_count: z.number().optional(),
      meter: z.string().optional(),
      usage_type: z.enum(['licensed', 'metered']).optional(),
    })
    .optional(),
  active: z.boolean().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  nickname: z.string().optional(),
  lookup_key: z.string().optional(),
  tax_behavior: z.enum(['exclusive', 'inclusive', 'unspecified']).optional(),
  billing_scheme: z.enum(['per_unit', 'tiered']).optional(),
  tiers_mode: z.enum(['graduated', 'volume']).optional(),
});

const ProviderPriceSchema = z.object({
  id: z.string(),
  object: z.string(),
  active: z.boolean(),
  billing_scheme: z.string().nullable().optional(),
  created: z.number(),
  currency: z.string(),
  custom_unit_amount: z
    .object({
      enabled: z.boolean().nullable(),
      maximum: z.number().nullable(),
      minimum: z.number().nullable(),
      preset: z.number().nullable(),
    })
    .nullable()
    .optional(),
  livemode: z.boolean(),
  lookup_key: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  nickname: z.string().nullable().optional(),
  product: z.string().nullable().optional(),
  recurring: z
    .object({
      interval: z.string(),
      interval_count: z.number(),
      trial_period_days: z.number().nullable(),
      usage_type: z.string(),
    })
    .nullable()
    .optional(),
  tax_behavior: z.string().nullable().optional(),
  tiers_mode: z.string().nullable().optional(),
  transform_quantity: z
    .object({
      divide_by: z.number(),
      round: z.string(),
    })
    .nullable()
    .optional(),
  type: z.string(),
  unit_amount: z.number().nullable().optional(),
  unit_amount_decimal: z.string().nullable().optional(),
});

export const createPriceOutputSchema = z.object({
  id: z.string(),
  active: z.boolean(),
  billing_scheme: z.string().optional(),
  created: z.number(),
  currency: z.string(),
  custom_unit_amount: z
    .object({
      enabled: z.boolean().optional(),
      maximum: z.number().optional(),
      minimum: z.number().optional(),
      preset: z.number().optional(),
    })
    .optional(),
  livemode: z.boolean(),
  lookup_key: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  nickname: z.string().optional(),
  product: z.string().optional(),
  recurring: z
    .object({
      interval: z.string(),
      interval_count: z.number(),
      trial_period_days: z.number().optional(),
      usage_type: z.string(),
    })
    .optional(),
  tax_behavior: z.string().optional(),
  tiers_mode: z.string().optional(),
  transform_quantity: z
    .object({
      divide_by: z.number(),
      round: z.string(),
    })
    .optional(),
  type: z.string(),
  unit_amount: z.number().optional(),
  unit_amount_decimal: z.string().optional(),
});

interface StripeFormData {
  [key: string]:
    | string
    | number
    | boolean
    | null
    | undefined
    | StripeFormData
    | Array<string | number | boolean | null | undefined | StripeFormData>;
}

function isStripeFormData(value: unknown): value is StripeFormData {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function flattenStripeParams(obj: StripeFormData, prefix = ''): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) {
      continue;
    }
    const newKey = prefix ? `${prefix}[${key}]` : key;
    if (isStripeFormData(value)) {
      entries.push(...flattenStripeParams(value, newKey));
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (isStripeFormData(item)) {
          entries.push(...flattenStripeParams(item, `${newKey}[${i}]`));
        } else if (item !== undefined && item !== null) {
          entries.push([`${newKey}[${i}]`, String(item)]);
        }
      }
    } else {
      entries.push([newKey, String(value)]);
    }
  }
  return entries;
}

function toStripeFormUrlEncoded(obj: StripeFormData): string {
  const entries = flattenStripeParams(obj);
  return entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
}

export function createPriceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_create_price',
    description: 'Create a price in Stripe.',
    inputSchema: createPriceInputSchema,
    outputSchema: createPriceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createPriceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const data: StripeFormData = {
        currency: input.currency,
        ...(input.unit_amount !== undefined && { unit_amount: input.unit_amount }),
        ...(input.unit_amount_decimal !== undefined && { unit_amount_decimal: input.unit_amount_decimal }),
        ...(input.product !== undefined && { product: input.product }),
        ...(input.active !== undefined && { active: input.active }),
        ...(input.metadata !== undefined && { metadata: input.metadata }),
        ...(input.nickname !== undefined && { nickname: input.nickname }),
        ...(input.lookup_key !== undefined && { lookup_key: input.lookup_key }),
        ...(input.tax_behavior !== undefined && { tax_behavior: input.tax_behavior }),
        ...(input.billing_scheme !== undefined && { billing_scheme: input.billing_scheme }),
        ...(input.tiers_mode !== undefined && { tiers_mode: input.tiers_mode }),
      };

      if (input.custom_unit_amount !== undefined) {
        data['custom_unit_amount'] = input.custom_unit_amount;
      }

      if (input.product_data !== undefined) {
        data['product_data'] = input.product_data;
      }

      if (input.recurring !== undefined) {
        data['recurring'] = input.recurring;
      }

      const config: PlatformProxyRequest = {
        // https://docs.stripe.com/api/prices/create
        endpoint: '/v1/prices',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: toStripeFormUrlEncoded(data),
        retries: 3,
      };

      const response = await platformProxy.post(config);

      const providerPrice = ProviderPriceSchema.parse(response.data);

      return {
        id: providerPrice.id,
        active: providerPrice.active,
        ...(providerPrice.billing_scheme != null && { billing_scheme: providerPrice.billing_scheme }),
        created: providerPrice.created,
        currency: providerPrice.currency,
        ...(providerPrice.custom_unit_amount != null && {
          custom_unit_amount: {
            ...(providerPrice.custom_unit_amount.enabled != null && {
              enabled: providerPrice.custom_unit_amount.enabled,
            }),
            ...(providerPrice.custom_unit_amount.maximum != null && {
              maximum: providerPrice.custom_unit_amount.maximum,
            }),
            ...(providerPrice.custom_unit_amount.minimum != null && {
              minimum: providerPrice.custom_unit_amount.minimum,
            }),
            ...(providerPrice.custom_unit_amount.preset != null && { preset: providerPrice.custom_unit_amount.preset }),
          },
        }),
        livemode: providerPrice.livemode,
        ...(providerPrice.lookup_key != null && { lookup_key: providerPrice.lookup_key }),
        ...(providerPrice.metadata !== undefined && { metadata: providerPrice.metadata }),
        ...(providerPrice.nickname != null && { nickname: providerPrice.nickname }),
        ...(providerPrice.product != null && { product: providerPrice.product }),
        ...(providerPrice.recurring != null && {
          recurring: {
            interval: providerPrice.recurring.interval,
            interval_count: providerPrice.recurring.interval_count,
            ...(providerPrice.recurring.trial_period_days != null && {
              trial_period_days: providerPrice.recurring.trial_period_days,
            }),
            usage_type: providerPrice.recurring.usage_type,
          },
        }),
        ...(providerPrice.tax_behavior != null && { tax_behavior: providerPrice.tax_behavior }),
        ...(providerPrice.tiers_mode != null && { tiers_mode: providerPrice.tiers_mode }),
        ...(providerPrice.transform_quantity != null && {
          transform_quantity: {
            divide_by: providerPrice.transform_quantity.divide_by,
            round: providerPrice.transform_quantity.round,
          },
        }),
        type: providerPrice.type,
        ...(providerPrice.unit_amount != null && { unit_amount: providerPrice.unit_amount }),
        ...(providerPrice.unit_amount_decimal != null && { unit_amount_decimal: providerPrice.unit_amount_decimal }),
      };
    },
  });
}
