// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createInvoiceInputSchema = z.object({
  customer: z.string().describe('The ID of the customer to bill. Example: "cus_123"'),
  collection_method: z.enum(['charge_automatically', 'send_invoice']).optional().describe('How to collect payment'),
  currency: z.string().optional().describe('Three-letter ISO currency code. Example: "usd"'),
  description: z.string().optional().describe('An arbitrary string attached to the object'),
  days_until_due: z.number().int().optional().describe('Number of days until due. Valid only for send_invoice'),
  due_date: z.number().int().optional().describe('Unix timestamp for due date. Valid only for send_invoice'),
  default_payment_method: z.string().optional().describe('ID of default payment method'),
  auto_advance: z.boolean().optional().describe('Controls automatic collection'),
  pending_invoice_items_behavior: z
    .enum(['exclude', 'include'])
    .optional()
    .describe('How to handle pending invoice items'),
  subscription: z.string().optional().describe('ID of subscription to invoice'),
  statement_descriptor: z.string().optional().describe('Descriptor for credit card statement'),
  footer: z.string().optional().describe('Footer displayed on invoice'),
  number: z.string().optional().describe('Invoice number'),
  metadata: z.record(z.string(), z.string()).optional().describe('Key-value pairs for metadata'),
});

const ProviderInvoiceSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    account_country: z.string().optional(),
    account_name: z.string().nullable().optional(),
    account_tax_ids: z.unknown().nullable().optional(),
    amount_due: z.number().optional(),
    amount_paid: z.number().optional(),
    amount_overpaid: z.number().optional(),
    amount_remaining: z.number().optional(),
    amount_shipping: z.number().optional(),
    application: z.unknown().nullable().optional(),
    application_fee_amount: z.number().nullable().optional(),
    attempt_count: z.number().optional(),
    attempted: z.boolean().optional(),
    auto_advance: z.boolean().optional(),
    automatic_tax: z
      .object({
        enabled: z.boolean(),
        liability: z.unknown().nullable().optional(),
        status: z.string().nullable().optional(),
      })
      .optional(),
    billing_reason: z.string().nullable().optional(),
    collection_method: z.string().optional(),
    created: z.number().optional(),
    currency: z.string().optional(),
    custom_fields: z.unknown().nullable().optional(),
    customer: z.string().optional(),
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
    effective_at: z.number().nullable().optional(),
    ending_balance: z.number().nullable().optional(),
    footer: z.string().nullable().optional(),
    from_invoice: z.unknown().nullable().optional(),
    hosted_invoice_url: z.string().nullable().optional(),
    invoice_pdf: z.string().nullable().optional(),
    issuer: z
      .object({
        type: z.string(),
        account: z.string().optional(),
      })
      .optional(),
    last_finalization_error: z.unknown().nullable().optional(),
    latest_revision: z.string().nullable().optional(),
    lines: z
      .object({
        object: z.string(),
        data: z.array(z.unknown()),
        has_more: z.boolean(),
        total_count: z.number(),
        url: z.string(),
      })
      .optional(),
    livemode: z.boolean().optional(),
    metadata: z.record(z.string(), z.string()).optional(),
    next_payment_attempt: z.number().nullable().optional(),
    number: z.string().nullable().optional(),
    on_behalf_of: z.string().nullable().optional(),
    parent: z.unknown().nullable().optional(),
    payment_settings: z
      .object({
        default_mandate: z.string().nullable().optional(),
        payment_method_options: z.unknown().nullable().optional(),
        payment_method_types: z.array(z.string()).nullable().optional(),
      })
      .optional(),
    period_end: z.number().optional(),
    period_start: z.number().optional(),
    post_payment_credit_notes_amount: z.number().optional(),
    pre_payment_credit_notes_amount: z.number().optional(),
    receipt_number: z.string().nullable().optional(),
    shipping_cost: z.unknown().nullable().optional(),
    shipping_details: z.unknown().nullable().optional(),
    starting_balance: z.number().optional(),
    statement_descriptor: z.string().nullable().optional(),
    status: z.string().optional(),
    status_transitions: z
      .object({
        finalized_at: z.number().nullable().optional(),
        marked_uncollectible_at: z.number().nullable().optional(),
        paid_at: z.number().nullable().optional(),
        voided_at: z.number().nullable().optional(),
      })
      .optional(),
    subtotal: z.number().optional(),
    subtotal_excluding_tax: z.number().optional(),
    test_clock: z.unknown().nullable().optional(),
    total: z.number().optional(),
    total_discount_amounts: z.array(z.unknown()).optional(),
    total_excluding_tax: z.number().optional(),
    total_taxes: z.array(z.unknown()).optional(),
    webhooks_delivered_at: z.number().optional(),
  })
  .passthrough();

export const createInvoiceOutputSchema = ProviderInvoiceSchema;

export function createInvoiceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_create_invoice',
    description: 'Create an invoice in Stripe',
    inputSchema: createInvoiceInputSchema,
    outputSchema: createInvoiceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createInvoiceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params = new URLSearchParams();
      params.append('customer', input.customer);

      if (input.collection_method !== undefined) {
        params.append('collection_method', input.collection_method);
      }
      if (input.currency !== undefined) {
        params.append('currency', input.currency);
      }
      if (input.description !== undefined) {
        params.append('description', input.description);
      }
      if (input.days_until_due !== undefined) {
        params.append('days_until_due', String(input.days_until_due));
      }
      if (input.due_date !== undefined) {
        params.append('due_date', String(input.due_date));
      }
      if (input.default_payment_method !== undefined) {
        params.append('default_payment_method', input.default_payment_method);
      }
      if (input.auto_advance !== undefined) {
        params.append('auto_advance', String(input.auto_advance));
      }
      if (input.pending_invoice_items_behavior !== undefined) {
        params.append('pending_invoice_items_behavior', input.pending_invoice_items_behavior);
      }
      if (input.subscription !== undefined) {
        params.append('subscription', input.subscription);
      }
      if (input.statement_descriptor !== undefined) {
        params.append('statement_descriptor', input.statement_descriptor);
      }
      if (input.footer !== undefined) {
        params.append('footer', input.footer);
      }
      if (input.number !== undefined) {
        params.append('number', input.number);
      }
      if (input.metadata !== undefined) {
        for (const [key, value] of Object.entries(input.metadata)) {
          params.append(`metadata[${key}]`, value);
        }
      }

      const data = params.toString();

      // https://docs.stripe.com/api/invoices/create
      const response = await platformProxy.post({
        endpoint: '/v1/invoices',
        data,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        retries: 3,
      });

      const providerInvoice = ProviderInvoiceSchema.parse(response.data);

      return providerInvoice;
    },
  });
}
