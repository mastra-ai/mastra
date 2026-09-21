// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createInvoiceItemInputSchema = z.object({
  customer: z.string().describe('The ID of the customer to bill for this invoice item. Example: "cus_xxx"'),
  amount: z.number().optional().describe('The integer amount in the smallest currency unit.'),
  currency: z.string().optional().describe('Three-letter ISO currency code, in lowercase. Example: "usd"'),
  price: z
    .string()
    .optional()
    .describe('The ID of an existing Price object to use for this invoice item. Example: "price_xxx"'),
  invoice: z.string().optional().describe('The ID of an existing draft invoice to add this item to. Example: "in_xxx"'),
  description: z.string().optional().describe('An arbitrary string to attach to the invoice item.'),
  quantity: z.number().optional().describe('The quantity of units for the invoice item.'),
});

const ProviderInvoiceItemSchema = z.object({
  id: z.string(),
  object: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  customer: z.string().optional(),
  date: z.number().optional(),
  description: z.string().nullable().optional(),
  discountable: z.boolean().optional(),
  discounts: z.array(z.unknown()).optional(),
  invoice: z.string().nullable().optional(),
  livemode: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  parent: z.unknown().nullable().optional(),
  period: z
    .object({
      end: z.number().optional(),
      start: z.number().optional(),
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
  test_clock: z.unknown().nullable().optional(),
});

export const createInvoiceItemOutputSchema = z.object({
  id: z.string(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  customer_id: z.string().optional(),
  description: z.string().optional(),
  invoice_id: z.string().optional(),
  quantity: z.number().optional(),
  price_id: z.string().optional(),
  livemode: z.boolean().optional(),
  created_at: z.number().optional(),
});

export function createInvoiceItemTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_create_invoice_item',
    description: 'Create an invoice item in Stripe.',
    inputSchema: createInvoiceItemInputSchema,
    outputSchema: createInvoiceItemOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createInvoiceItemOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const body = new URLSearchParams();
      body.append('customer', input.customer);
      if (input.amount !== undefined) {
        body.append('amount', String(input.amount));
      }
      if (input.currency !== undefined) {
        body.append('currency', input.currency);
      }
      if (input.price !== undefined) {
        body.append('pricing[price]', input.price);
      }
      if (input.invoice !== undefined) {
        body.append('invoice', input.invoice);
      }
      if (input.description !== undefined) {
        body.append('description', input.description);
      }
      if (input.quantity !== undefined) {
        body.append('quantity', String(input.quantity));
      }

      const response = await platformProxy.post({
        // https://docs.stripe.com/api/invoiceitems/create
        endpoint: '/v1/invoiceitems',
        data: body.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        retries: 3,
      });

      const providerItem = ProviderInvoiceItemSchema.parse(response.data);

      return {
        id: providerItem.id,
        ...(providerItem.amount !== undefined && { amount: providerItem.amount }),
        ...(providerItem.currency !== undefined && { currency: providerItem.currency }),
        ...(providerItem.customer !== undefined && { customer_id: providerItem.customer }),
        ...(providerItem.description != null && { description: providerItem.description }),
        ...(providerItem.invoice != null && { invoice_id: providerItem.invoice }),
        ...(providerItem.quantity !== undefined && { quantity: providerItem.quantity }),
        ...(providerItem.pricing?.price_details?.price !== undefined && {
          price_id: providerItem.pricing.price_details.price,
        }),
        ...(providerItem.livemode !== undefined && { livemode: providerItem.livemode }),
        ...(providerItem.date !== undefined && { created_at: providerItem.date }),
      };
    },
  });
}
