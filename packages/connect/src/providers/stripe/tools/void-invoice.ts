// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const voidInvoiceInputSchema = z.object({
  invoice_id: z.string().describe('The ID of the invoice to void. Example: "in_xxx"'),
});

const ProviderInvoiceSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    status: z.string().optional(),
    amount_due: z.number().optional(),
    amount_paid: z.number().optional(),
    amount_remaining: z.number().optional(),
    application_fee_amount: z.number().nullable().optional(),
    attempt_count: z.number().optional(),
    attempted: z.boolean().optional(),
    auto_advance: z.boolean().optional(),
    billing_reason: z.string().nullable().optional(),
    charge: z.string().nullable().optional(),
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
    default_payment_method: z.string().nullable().optional(),
    default_tax_rates: z.array(z.unknown()).optional(),
    description: z.string().nullable().optional(),
    discount: z.unknown().nullable().optional(),
    discounts: z.array(z.unknown()).optional(),
    due_date: z.number().nullable().optional(),
    ending_balance: z.number().nullable().optional(),
    footer: z.string().nullable().optional(),
    hosted_invoice_url: z.string().nullable().optional(),
    invoice_pdf: z.string().nullable().optional(),
    lines: z
      .object({
        object: z.string().optional(),
        data: z.array(z.unknown()).optional(),
        has_more: z.boolean().optional(),
        url: z.string().optional(),
      })
      .optional(),
    livemode: z.boolean().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    next_payment_attempt: z.number().nullable().optional(),
    number: z.string().nullable().optional(),
    on_behalf_of: z.string().nullable().optional(),
    paid: z.boolean().optional(),
    payment_intent: z.string().nullable().optional(),
    period_end: z.number().optional(),
    period_start: z.number().optional(),
    post_payment_credit_notes_amount: z.number().optional(),
    pre_payment_credit_notes_amount: z.number().optional(),
    quote: z.string().nullable().optional(),
    receipt_number: z.string().nullable().optional(),
    starting_balance: z.number().optional(),
    statement_descriptor: z.string().nullable().optional(),
    status_transitions: z
      .object({
        finalized_at: z.number().nullable().optional(),
        marked_uncollectible_at: z.number().nullable().optional(),
        paid_at: z.number().nullable().optional(),
        voided_at: z.number().nullable().optional(),
      })
      .optional(),
    subscription: z.string().nullable().optional(),
    subtotal: z.number().optional(),
    tax: z.number().nullable().optional(),
    total: z.number().optional(),
    total_discount_amounts: z.array(z.unknown()).optional(),
    total_tax_amounts: z.array(z.unknown()).optional(),
    transfer_data: z.unknown().nullable().optional(),
    webhooks_delivered_at: z.number().nullable().optional(),
  })
  .passthrough();

export const voidInvoiceOutputSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  amount_due: z.number().optional(),
  amount_paid: z.number().optional(),
  amount_remaining: z.number().optional(),
  currency: z.string().optional(),
  customer: z.string().optional(),
  description: z.string().optional(),
  hosted_invoice_url: z.string().optional(),
  invoice_pdf: z.string().optional(),
  lines: z
    .object({
      object: z.string().optional(),
      data: z.array(z.unknown()).optional(),
      has_more: z.boolean().optional(),
      url: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  number: z.string().optional(),
  paid: z.boolean().optional(),
  payment_intent: z.string().optional(),
  period_end: z.number().optional(),
  period_start: z.number().optional(),
  subtotal: z.number().optional(),
  total: z.number().optional(),
  voided_at: z.number().optional(),
  created: z.number().optional(),
});

export function voidInvoiceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_void_invoice',
    description: 'Void a Stripe invoice.',
    inputSchema: voidInvoiceInputSchema,
    outputSchema: voidInvoiceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof voidInvoiceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.stripe.com/api/invoices/void
        endpoint: `/v1/invoices/${encodeURIComponent(input.invoice_id)}/void`,
        retries: 3,
      });

      const invoice = ProviderInvoiceSchema.parse(response.data);

      return {
        id: invoice.id,
        ...(invoice.status !== undefined && { status: invoice.status }),
        ...(invoice.amount_due !== undefined && { amount_due: invoice.amount_due }),
        ...(invoice.amount_paid !== undefined && { amount_paid: invoice.amount_paid }),
        ...(invoice.amount_remaining !== undefined && { amount_remaining: invoice.amount_remaining }),
        ...(invoice.currency !== undefined && { currency: invoice.currency }),
        ...(invoice.customer !== undefined && { customer: invoice.customer }),
        ...(invoice.description != null && { description: invoice.description }),
        ...(invoice.hosted_invoice_url != null && { hosted_invoice_url: invoice.hosted_invoice_url }),
        ...(invoice.invoice_pdf != null && { invoice_pdf: invoice.invoice_pdf }),
        ...(invoice.lines !== undefined && { lines: invoice.lines }),
        ...(invoice.metadata !== undefined && { metadata: invoice.metadata }),
        ...(invoice.number != null && { number: invoice.number }),
        ...(invoice.paid !== undefined && { paid: invoice.paid }),
        ...(invoice.payment_intent != null && { payment_intent: invoice.payment_intent }),
        ...(invoice.period_end !== undefined && { period_end: invoice.period_end }),
        ...(invoice.period_start !== undefined && { period_start: invoice.period_start }),
        ...(invoice.subtotal !== undefined && { subtotal: invoice.subtotal }),
        ...(invoice.total !== undefined && { total: invoice.total }),
        ...(invoice.status_transitions?.voided_at != null && { voided_at: invoice.status_transitions.voided_at }),
        ...(invoice.created !== undefined && { created: invoice.created }),
      };
    },
  });
}
