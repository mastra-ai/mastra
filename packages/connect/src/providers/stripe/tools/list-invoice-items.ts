// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listInvoiceItemsInputSchema = z.object({
  customer: z.string().optional().describe('The identifier of the customer whose invoice items to return.'),
  invoice: z.string().optional().describe('Only return invoice items belonging to this invoice.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe(
      'A limit on the number of objects to be returned. Limit can range between 1 and 100, and the default is 10.',
    ),
  pending: z
    .boolean()
    .optional()
    .describe('Set to true to only show pending invoice items, which are not yet attached to any invoices.'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const InvoiceItemSchema = z
  .object({
    id: z.string(),
    object: z.string(),
    amount: z.number(),
    currency: z.string(),
    customer: z.string().nullable().optional(),
    date: z.number(),
    description: z.string().nullable().optional(),
    discountable: z.boolean(),
    discounts: z.array(z.unknown()),
    invoice: z.string().nullable().optional(),
    livemode: z.boolean(),
    metadata: z.record(z.string(), z.unknown()),
    parent: z.unknown().nullable().optional(),
    period: z
      .object({
        end: z.number(),
        start: z.number(),
      })
      .optional(),
    pricing: z.unknown().optional(),
    proration: z.boolean(),
    quantity: z.number(),
    quantity_decimal: z.string().optional(),
    tax_rates: z.array(z.unknown()),
    test_clock: z.unknown().nullable().optional(),
  })
  .passthrough();

export const listInvoiceItemsOutputSchema = z.object({
  items: z.array(InvoiceItemSchema),
  has_more: z.boolean(),
  next_cursor: z.string().optional(),
});

export function listInvoiceItemsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_list_invoice_items',
    description: 'List invoice items from Stripe.',
    inputSchema: listInvoiceItemsInputSchema,
    outputSchema: listInvoiceItemsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listInvoiceItemsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.stripe.com/api/invoiceitems/list
        endpoint: '/v1/invoiceitems',
        params: {
          ...(input.customer !== undefined && { customer: input.customer }),
          ...(input.invoice !== undefined && { invoice: input.invoice }),
          ...(input.limit !== undefined && { limit: String(input.limit) }),
          ...(input.pending !== undefined && { pending: String(input.pending) }),
          ...(input.cursor !== undefined && { starting_after: input.cursor }),
        },
        retries: 3,
      });

      const listSchema = z.object({
        object: z.literal('list'),
        has_more: z.boolean(),
        data: z.array(z.unknown()),
      });

      const list = listSchema.parse(response.data);
      const items = list.data.map(item => InvoiceItemSchema.parse(item));

      const lastItem = items.length > 0 ? items[items.length - 1] : undefined;

      return {
        items: items,
        has_more: list.has_more,
        ...(list.has_more && lastItem !== undefined && { next_cursor: lastItem.id }),
      };
    },
  });
}
