// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getInvoiceInputSchema = z.object({
  id: z.string().describe('The ID of the invoice to retrieve. Example: in_1TbSpyEZpD6kXrae3uL2sSEg'),
});

export const getInvoiceOutputSchema = z
  .object({
    id: z.string(),
    object: z.literal('invoice'),
    account_country: z.string().nullable().optional(),
    account_name: z.string().nullable().optional(),
    account_tax_ids: z.array(z.string()).nullable().optional(),
    amount_due: z.number().optional(),
    amount_paid: z.number().optional(),
    amount_remaining: z.number().optional(),
    amount_shipping: z.number().optional(),
    application: z.string().nullable().optional(),
    application_fee_amount: z.number().nullable().optional(),
    attempt_count: z.number().optional(),
    attempted: z.boolean().optional(),
    auto_advance: z.boolean().nullable().optional(),
    automatic_tax: z
      .object({
        enabled: z.boolean(),
        liability: z.string().nullable().optional(),
        status: z.string().nullable().optional(),
      })
      .optional(),
    billing_reason: z.string().nullable().optional(),
    charge: z.string().nullable().optional(),
    collection_method: z.string().nullable().optional(),
    created: z.number().optional(),
    currency: z.string().optional(),
    custom_fields: z
      .array(
        z.object({
          name: z.string(),
          value: z.string(),
        }),
      )
      .nullable()
      .optional(),
    customer: z.string().nullable().optional(),
    customer_address: z
      .object({
        city: z.string().nullable().optional(),
        country: z.string().nullable().optional(),
        line1: z.string().nullable().optional(),
        line2: z.string().nullable().optional(),
        postal_code: z.string().nullable().optional(),
        state: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    customer_balance: z.number().optional(),
    customer_email: z.string().nullable().optional(),
    customer_name: z.string().nullable().optional(),
    customer_phone: z.string().nullable().optional(),
    customer_shipping: z
      .object({
        address: z
          .object({
            city: z.string().nullable().optional(),
            country: z.string().nullable().optional(),
            line1: z.string().nullable().optional(),
            line2: z.string().nullable().optional(),
            postal_code: z.string().nullable().optional(),
            state: z.string().nullable().optional(),
          })
          .nullable()
          .optional(),
        name: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    customer_tax_exempt: z.string().nullable().optional(),
    customer_tax_ids: z
      .array(
        z.object({
          type: z.string(),
          value: z.string(),
        }),
      )
      .nullable()
      .optional(),
    default_payment_method: z.string().nullable().optional(),
    default_source: z.string().nullable().optional(),
    default_tax_rates: z.array(z.unknown()).nullable().optional(),
    description: z.string().nullable().optional(),
    discount: z.unknown().nullable().optional(),
    discounts: z.array(z.unknown()).nullable().optional(),
    due_date: z.number().nullable().optional(),
    effective_at: z.number().nullable().optional(),
    ending_balance: z.number().nullable().optional(),
    footer: z.string().nullable().optional(),
    from_invoice: z.unknown().nullable().optional(),
    hosted_invoice_url: z.string().nullable().optional(),
    invoice_pdf: z.string().nullable().optional(),
    last_finalization_error: z.unknown().nullable().optional(),
    latest_revision: z.string().nullable().optional(),
    lines: z
      .object({
        object: z.literal('list'),
        data: z.array(z.unknown()),
        has_more: z.boolean(),
        url: z.string().optional(),
      })
      .optional(),
    livemode: z.boolean().optional(),
    metadata: z.record(z.string(), z.string()).nullable().optional(),
    next_payment_attempt: z.number().nullable().optional(),
    number: z.string().nullable().optional(),
    on_behalf_of: z.string().nullable().optional(),
    paid: z.boolean().optional(),
    paid_out_of_band: z.boolean().optional(),
    payment_intent: z.string().nullable().optional(),
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
    quote: z.string().nullable().optional(),
    receipt_number: z.string().nullable().optional(),
    rendering: z.unknown().nullable().optional(),
    rendering_options: z.unknown().nullable().optional(),
    shipping_cost: z.unknown().nullable().optional(),
    shipping_details: z.unknown().nullable().optional(),
    starting_balance: z.number().optional(),
    statement_descriptor: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    status_transitions: z
      .object({
        finalized_at: z.number().nullable().optional(),
        marked_uncollectible_at: z.number().nullable().optional(),
        paid_at: z.number().nullable().optional(),
        voided_at: z.number().nullable().optional(),
      })
      .optional(),
    subscription: z.string().nullable().optional(),
    subscription_details: z.unknown().nullable().optional(),
    subtotal: z.number().optional(),
    subtotal_excluding_tax: z.number().nullable().optional(),
    tax: z.number().nullable().optional(),
    test_clock: z.string().nullable().optional(),
    total: z.number().optional(),
    total_discount_amounts: z.array(z.unknown()).nullable().optional(),
    total_excluding_tax: z.number().nullable().optional(),
    total_pretax_credit_amounts: z.array(z.unknown()).nullable().optional(),
    total_tax_amounts: z.array(z.unknown()).nullable().optional(),
    transfer_data: z.unknown().nullable().optional(),
    webhooks_delivered_at: z.number().nullable().optional(),
  })
  .passthrough();

export function getInvoiceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_get_invoice',
    description: 'Retrieve a single invoice from Stripe.',
    inputSchema: getInvoiceInputSchema,
    outputSchema: getInvoiceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getInvoiceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.stripe.com/api/invoices/retrieve
      const response = await platformProxy.get({
        endpoint: `/v1/invoices/${encodeURIComponent(input.id)}`,
        retries: 3,
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Invoice not found',
          id: input.id,
        });
      }

      const invoice = getInvoiceOutputSchema.parse(response.data);
      return invoice;
    },
  });
}
