// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getInvoiceItemInputSchema = z.object({
  invoice_item_id: z.string().describe('The ID of the invoice item to retrieve. Example: ii_1MtGUtLkdIwHu7ixBYwjAM00'),
});

const PeriodSchema = z.object({
  end: z.number(),
  start: z.number(),
});

const PriceDetailsSchema = z
  .object({
    price: z.string().optional(),
    product: z.string().optional(),
  })
  .passthrough();

const PricingSchema = z
  .object({
    price_details: PriceDetailsSchema.nullable().optional(),
    type: z.string().optional(),
    unit_amount_decimal: z.string().nullable().optional(),
  })
  .passthrough();

const ParentSubscriptionDetailsSchema = z
  .object({
    subscription: z.string(),
    subscription_item: z.string().nullable().optional(),
  })
  .passthrough();

const ParentSchema = z
  .object({
    subscription_details: ParentSubscriptionDetailsSchema.nullable().optional(),
    type: z.string().optional(),
  })
  .passthrough();

const DiscountAmountSchema = z
  .object({
    amount: z.number(),
    discount: z.string(),
  })
  .passthrough();

const ProrationDetailsSchema = z
  .object({
    discount_amounts: z.array(DiscountAmountSchema).optional(),
  })
  .passthrough();

const FlatAmountSchema = z
  .object({
    amount: z.number(),
    currency: z.string(),
  })
  .passthrough();

const TaxRateSchema = z
  .object({
    id: z.string(),
    object: z.string(),
    active: z.boolean(),
    country: z.string().nullable().optional(),
    created: z.number(),
    description: z.string().nullable().optional(),
    display_name: z.string(),
    effective_percentage: z.number().nullable().optional(),
    flat_amount: FlatAmountSchema.nullable().optional(),
    inclusive: z.boolean(),
    jurisdiction: z.string().nullable().optional(),
    jurisdiction_level: z.string().nullable().optional(),
    livemode: z.boolean(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    percentage: z.number(),
    rate_type: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    tax_type: z.string().nullable().optional(),
  })
  .passthrough();

export const getInvoiceItemOutputSchema = z
  .object({
    id: z.string(),
    object: z.string(),
    amount: z.number(),
    currency: z.string(),
    customer: z.string(),
    customer_account: z.string().nullable().optional(),
    date: z.number(),
    description: z.string().nullable().optional(),
    discountable: z.boolean(),
    discounts: z.array(z.string()).nullable().optional(),
    invoice: z.string().nullable().optional(),
    livemode: z.boolean(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    net_amount: z.number().nullable().optional(),
    parent: ParentSchema.nullable().optional(),
    period: PeriodSchema,
    pricing: PricingSchema.nullable().optional(),
    proration: z.boolean(),
    proration_details: ProrationDetailsSchema.nullable().optional(),
    quantity: z.number(),
    quantity_decimal: z.string().optional(),
    tax_rates: z.array(TaxRateSchema).nullable().optional(),
    test_clock: z.string().nullable().optional(),
  })
  .passthrough();

export function getInvoiceItemTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_get_invoice_item',
    description: 'Retrieve a single invoice item from Stripe.',
    inputSchema: getInvoiceItemInputSchema,
    outputSchema: getInvoiceItemOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getInvoiceItemOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.stripe.com/api/invoiceitems/retrieve
      const response = await platformProxy.get({
        endpoint: `/v1/invoiceitems/${encodeURIComponent(input.invoice_item_id)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Invoice item ${input.invoice_item_id} not found`,
        });
      }

      const providerItem = getInvoiceItemOutputSchema.parse(response.data);
      return providerItem;
    },
  });
}
