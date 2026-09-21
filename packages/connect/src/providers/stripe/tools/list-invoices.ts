// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listInvoicesInputSchema = z.object({
  customer: z
    .string()
    .optional()
    .describe('Only return invoices for the customer specified by this customer ID. Example: "cus_Uae6TTxHlP2hxk"'),
  status: z.enum(['draft', 'open', 'paid', 'uncollectible', 'void']).optional().describe('The status of the invoice.'),
  subscription: z
    .string()
    .optional()
    .describe(
      'Only return invoices for the subscription specified by this subscription ID. Example: "sub_1TbSpTEZpD6kXraenpiDSgpD"',
    ),
  collection_method: z
    .enum(['charge_automatically', 'send_invoice'])
    .optional()
    .describe('The collection method of the invoice to retrieve.'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe(
      'A limit on the number of objects to be returned. Limit can range between 1 and 100, and the default is 10.',
    ),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor from the previous response (maps to starting_after). Omit for the first page.'),
});

const ProviderInvoiceSchema = z
  .object({
    id: z.string(),
    object: z.literal('invoice'),
    account_country: z.string().optional(),
    account_name: z.string().nullable().optional(),
    account_tax_ids: z.unknown().nullable().optional(),
    amount_due: z.number(),
    amount_paid: z.number(),
    amount_overpaid: z.number().optional(),
    amount_remaining: z.number(),
    amount_shipping: z.number().optional(),
    application: z.string().nullable().optional(),
    attempt_count: z.number(),
    attempted: z.boolean(),
    auto_advance: z.boolean().nullable().optional(),
    automatic_tax: z.record(z.string(), z.unknown()).optional(),
    billing_reason: z.string().nullable().optional(),
    collection_method: z.string().optional(),
    created: z.number(),
    currency: z.string(),
    custom_fields: z.unknown().nullable().optional(),
    customer: z.string().nullable().optional(),
    customer_address: z.unknown().nullable().optional(),
    customer_email: z.string().nullable().optional(),
    customer_name: z.string().nullable().optional(),
    customer_phone: z.string().nullable().optional(),
    customer_shipping: z.unknown().nullable().optional(),
    customer_tax_exempt: z.string().nullable().optional(),
    customer_tax_ids: z.array(z.unknown()).optional(),
    default_payment_method: z.string().nullable().optional(),
    default_source: z.string().nullable().optional(),
    default_tax_rates: z.array(z.unknown()).optional(),
    description: z.string().nullable().optional(),
    discounts: z.array(z.unknown()).optional(),
    due_date: z.number().nullable().optional(),
    ending_balance: z.number().nullable().optional(),
    footer: z.string().nullable().optional(),
    from_invoice: z.unknown().nullable().optional(),
    hosted_invoice_url: z.string().nullable().optional(),
    invoice_pdf: z.string().nullable().optional(),
    issuer: z.record(z.string(), z.unknown()).optional(),
    last_finalization_error: z.unknown().nullable().optional(),
    latest_revision: z.string().nullable().optional(),
    lines: z.record(z.string(), z.unknown()).optional(),
    livemode: z.boolean(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    next_payment_attempt: z.number().nullable().optional(),
    number: z.string().nullable().optional(),
    on_behalf_of: z.string().nullable().optional(),
    parent: z.unknown().nullable().optional(),
    payment_settings: z.record(z.string(), z.unknown()).optional(),
    period_end: z.number(),
    period_start: z.number(),
    post_payment_credit_notes_amount: z.number().optional(),
    pre_payment_credit_notes_amount: z.number().optional(),
    receipt_number: z.string().nullable().optional(),
    shipping_cost: z.unknown().nullable().optional(),
    shipping_details: z.unknown().nullable().optional(),
    starting_balance: z.number(),
    statement_descriptor: z.string().nullable().optional(),
    status: z.string().optional(),
    status_transitions: z.record(z.string(), z.unknown()).optional(),
    subtotal: z.number(),
    subtotal_excluding_tax: z.number().optional(),
    test_clock: z.string().nullable().optional(),
    total: z.number(),
    total_discount_amounts: z.array(z.unknown()).optional(),
    total_excluding_tax: z.number().optional(),
    total_taxes: z.array(z.unknown()).optional(),
    webhooks_delivered_at: z.number().nullable().optional(),
  })
  .passthrough();

export const listInvoicesOutputSchema = z.object({
  items: z.array(ProviderInvoiceSchema),
  has_more: z.boolean(),
  next_cursor: z.string().optional(),
});

export function listInvoicesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_list_invoices',
    description: 'List invoices from Stripe.',
    inputSchema: listInvoicesInputSchema,
    outputSchema: listInvoicesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listInvoicesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.stripe.com/api/invoices/list
        endpoint: '/v1/invoices',
        params: {
          ...(input.customer !== undefined && { customer: input.customer }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.subscription !== undefined && { subscription: input.subscription }),
          ...(input.collection_method !== undefined && { collection_method: input.collection_method }),
          ...(input.limit !== undefined && { limit: String(input.limit) }),
          ...(input.cursor !== undefined && { starting_after: input.cursor }),
        },
        retries: 3,
      });

      const listResponse = z
        .object({
          object: z.literal('list'),
          data: z.array(z.unknown()),
          has_more: z.boolean(),
          url: z.string(),
        })
        .parse(response.data);

      const items = listResponse.data.map((item: unknown) => {
        return ProviderInvoiceSchema.parse(item);
      });

      const lastItem = items[items.length - 1];

      return {
        items,
        has_more: listResponse.has_more,
        ...(listResponse.has_more && lastItem != null && { next_cursor: lastItem.id }),
      };
    },
  });
}
