// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateInvoiceItemInputSchema = z.object({
  invoice_item_id: z.string().describe('The ID of the invoice item to update. Example: "ii_1TbSq2EZpD6kXrae2X8tf717"'),
  amount: z.number().int().optional().describe('The integer amount in the smallest currency unit.'),
  description: z.string().optional().describe('An arbitrary string attached to the invoice item.'),
  discountable: z.boolean().optional().describe('Controls whether discounts apply to this invoice item.'),
  metadata: z.record(z.string(), z.string()).optional().describe('Set of key-value pairs to attach to the object.'),
  quantity: z.number().int().min(0).optional().describe('Non-negative integer quantity of units for the invoice item.'),
  quantity_decimal: z.string().optional().describe('Non-negative decimal quantity with at most 12 decimal places.'),
  tax_behavior: z
    .enum(['exclusive', 'inclusive', 'unspecified'])
    .optional()
    .describe('Specifies whether the price is inclusive or exclusive of taxes.'),
  tax_code: z.string().optional().describe('A tax code ID.'),
  unit_amount_decimal: z.string().optional().describe('The decimal unit amount in the smallest currency unit.'),
});

const ProviderDiscountSchema = z.object({
  coupon: z.string().optional(),
  discount: z.string().optional(),
  promotion_code: z.string().optional(),
});

const ProviderPeriodSchema = z.object({
  end: z.number(),
  start: z.number(),
});

const ProviderPriceDetailsSchema = z.object({
  price: z.string().optional(),
  product: z.string().optional(),
});

const ProviderPricingSchema = z.object({
  price_details: ProviderPriceDetailsSchema.optional(),
  type: z.string().optional(),
  unit_amount_decimal: z.string().optional(),
});

const ProviderInvoiceItemSchema = z.object({
  id: z.string(),
  object: z.string(),
  amount: z.number(),
  currency: z.string(),
  customer: z.string().nullable().optional(),
  date: z.number(),
  description: z.string().nullable().optional(),
  discountable: z.boolean().optional(),
  discounts: z.array(z.union([z.string(), ProviderDiscountSchema])).optional(),
  invoice: z.string().nullable().optional(),
  livemode: z.boolean(),
  metadata: z.record(z.string(), z.string()).optional(),
  parent: z.unknown().nullable().optional(),
  period: ProviderPeriodSchema.nullable().optional(),
  pricing: ProviderPricingSchema.nullable().optional(),
  proration: z.boolean().optional(),
  quantity: z.number().nullable().optional(),
  quantity_decimal: z.string().nullable().optional(),
  tax_rates: z.array(z.unknown()).optional(),
  test_clock: z.string().nullable().optional(),
  unit_amount_decimal: z.string().nullable().optional(),
});

export const updateInvoiceItemOutputSchema = z.object({
  id: z.string(),
  object: z.string(),
  amount: z.number(),
  currency: z.string(),
  customer: z.string().optional(),
  date: z.number(),
  description: z.string().optional(),
  discountable: z.boolean().optional(),
  discounts: z.array(z.unknown()).optional(),
  invoice: z.string().optional(),
  livemode: z.boolean(),
  metadata: z.record(z.string(), z.string()).optional(),
  period: z
    .object({
      end: z.number(),
      start: z.number(),
    })
    .optional(),
  pricing: z
    .object({
      price_details: z
        .object({
          price: z.string().optional(),
          product: z.string().optional(),
        })
        .optional(),
      type: z.string().optional(),
      unit_amount_decimal: z.string().optional(),
    })
    .optional(),
  proration: z.boolean().optional(),
  quantity: z.number().optional(),
  quantity_decimal: z.string().optional(),
  tax_rates: z.array(z.unknown()).optional(),
  unit_amount_decimal: z.string().optional(),
});

function toFormUrlEncoded(data: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      for (const [subKey, subValue] of Object.entries(value)) {
        if (subValue !== undefined && subValue !== null) {
          params.append(`${key}[${subKey}]`, String(subValue));
        }
      }
    } else {
      params.append(key, String(value));
    }
  }
  return params.toString();
}

export function updateInvoiceItemTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_update_invoice_item',
    description: 'Update an invoice item in Stripe.',
    inputSchema: updateInvoiceItemInputSchema,
    outputSchema: updateInvoiceItemOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateInvoiceItemOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const data: Record<string, unknown> = {};

      if (input.amount !== undefined) {
        data['amount'] = input.amount;
      }
      if (input.description !== undefined) {
        data['description'] = input.description;
      }
      if (input.discountable !== undefined) {
        data['discountable'] = input.discountable;
      }
      if (input.metadata !== undefined) {
        data['metadata'] = input.metadata;
      }
      if (input.quantity !== undefined) {
        data['quantity'] = input.quantity;
      }
      if (input.quantity_decimal !== undefined) {
        data['quantity_decimal'] = input.quantity_decimal;
      }
      if (input.tax_behavior !== undefined) {
        data['tax_behavior'] = input.tax_behavior;
      }
      if (input.tax_code !== undefined) {
        data['tax_code'] = input.tax_code;
      }
      if (input.unit_amount_decimal !== undefined) {
        data['unit_amount_decimal'] = input.unit_amount_decimal;
      }

      const response = await platformProxy.post({
        // https://docs.stripe.com/api/invoiceitems/update
        endpoint: `/v1/invoiceitems/${encodeURIComponent(input.invoice_item_id)}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: toFormUrlEncoded(data),
        retries: 3,
      });

      const providerInvoiceItem = ProviderInvoiceItemSchema.parse(response.data);

      return {
        id: providerInvoiceItem.id,
        object: providerInvoiceItem.object,
        amount: providerInvoiceItem.amount,
        currency: providerInvoiceItem.currency,
        date: providerInvoiceItem.date,
        livemode: providerInvoiceItem.livemode,
        ...(providerInvoiceItem.customer != null && { customer: providerInvoiceItem.customer }),
        ...(providerInvoiceItem.description != null && { description: providerInvoiceItem.description }),
        ...(providerInvoiceItem.discountable !== undefined && { discountable: providerInvoiceItem.discountable }),
        ...(providerInvoiceItem.discounts !== undefined && { discounts: providerInvoiceItem.discounts }),
        ...(providerInvoiceItem.invoice != null && { invoice: providerInvoiceItem.invoice }),
        ...(providerInvoiceItem.metadata !== undefined && { metadata: providerInvoiceItem.metadata }),
        ...(providerInvoiceItem.period != null && {
          period: {
            end: providerInvoiceItem.period.end,
            start: providerInvoiceItem.period.start,
          },
        }),
        ...(providerInvoiceItem.pricing != null && {
          pricing: {
            ...(providerInvoiceItem.pricing.price_details !== undefined && {
              price_details: {
                ...(providerInvoiceItem.pricing.price_details.price !== undefined && {
                  price: providerInvoiceItem.pricing.price_details.price,
                }),
                ...(providerInvoiceItem.pricing.price_details.product !== undefined && {
                  product: providerInvoiceItem.pricing.price_details.product,
                }),
              },
            }),
            ...(providerInvoiceItem.pricing.type !== undefined && { type: providerInvoiceItem.pricing.type }),
            ...(providerInvoiceItem.pricing.unit_amount_decimal !== undefined && {
              unit_amount_decimal: providerInvoiceItem.pricing.unit_amount_decimal,
            }),
          },
        }),
        ...(providerInvoiceItem.proration !== undefined && { proration: providerInvoiceItem.proration }),
        ...(providerInvoiceItem.quantity != null && { quantity: providerInvoiceItem.quantity }),
        ...(providerInvoiceItem.quantity_decimal != null && { quantity_decimal: providerInvoiceItem.quantity_decimal }),
        ...(providerInvoiceItem.tax_rates !== undefined && { tax_rates: providerInvoiceItem.tax_rates }),
        ...(providerInvoiceItem.unit_amount_decimal != null && {
          unit_amount_decimal: providerInvoiceItem.unit_amount_decimal,
        }),
      };
    },
  });
}
