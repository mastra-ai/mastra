// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const updateInvoiceInputSchema = z.object({
  id: z.string().describe('The ID of the invoice to update. Example: "in_1MtHbELkdIwHu7ixl4OzzPMv"'),
  description: z
    .string()
    .optional()
    .describe(
      "An arbitrary string attached to the object. Often useful for displaying to users. Referenced as 'memo' in the Dashboard.",
    ),
  auto_advance: z
    .boolean()
    .optional()
    .describe('Controls whether Stripe performs automatic collection of the invoice.'),
  collection_method: z
    .enum(['charge_automatically', 'send_invoice'])
    .optional()
    .describe('Either charge_automatically or send_invoice. This field can be updated only on draft invoices.'),
  days_until_due: z
    .number()
    .int()
    .optional()
    .describe(
      'The number of days from which the invoice is created until it is due. Only valid for invoices where collection_method=send_invoice. This field can only be updated on draft invoices.',
    ),
  due_date: z
    .number()
    .int()
    .optional()
    .describe(
      'The date on which payment for this invoice is due. Only valid for invoices where collection_method=send_invoice. This field can only be updated on draft invoices.',
    ),
  footer: z.string().optional().describe('Footer to be displayed on the invoice.'),
  statement_descriptor: z
    .string()
    .optional()
    .describe(
      "Extra information about a charge for the customer's credit card statement. It must contain at least one letter.",
    ),
  default_payment_method: z
    .string()
    .optional()
    .describe(
      'ID of the default payment method for the invoice. It must belong to the customer associated with the invoice.',
    ),
  metadata: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format.',
    ),
});

const ProviderInvoiceSchema = z.object({
  id: z.string(),
  object: z.string().optional(),
  amount_due: z.number().int().nullable().optional(),
  amount_paid: z.number().int().nullable().optional(),
  amount_remaining: z.number().int().nullable().optional(),
  auto_advance: z.boolean().nullable().optional(),
  billing_reason: z.string().nullable().optional(),
  collection_method: z.string().nullable().optional(),
  created: z.number().int().nullable().optional(),
  currency: z.string().nullable().optional(),
  customer: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  due_date: z.number().int().nullable().optional(),
  footer: z.string().nullable().optional(),
  hosted_invoice_url: z.string().nullable().optional(),
  invoice_pdf: z.string().nullable().optional(),
  lines: z
    .object({
      object: z.string(),
      data: z.array(z.unknown()),
      has_more: z.boolean(),
      total_count: z.number().int(),
      url: z.string(),
    })
    .nullable()
    .optional(),
  livemode: z.boolean().nullable().optional(),
  metadata: z.record(z.string(), z.string()).nullable().optional(),
  number: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  status_transitions: z
    .object({
      finalized_at: z.number().int().nullable().optional(),
      marked_uncollectible_at: z.number().int().nullable().optional(),
      paid_at: z.number().int().nullable().optional(),
      voided_at: z.number().int().nullable().optional(),
    })
    .nullable()
    .optional(),
  subtotal: z.number().int().nullable().optional(),
  total: z.number().int().nullable().optional(),
});

export const updateInvoiceOutputSchema = z.object({
  id: z.string(),
  object: z.string().optional(),
  amount_due: z.number().int().optional(),
  amount_paid: z.number().int().optional(),
  amount_remaining: z.number().int().optional(),
  auto_advance: z.boolean().optional(),
  billing_reason: z.string().optional(),
  collection_method: z.string().optional(),
  created: z.number().int().optional(),
  currency: z.string().optional(),
  customer: z.string().optional(),
  description: z.string().optional(),
  due_date: z.number().int().optional(),
  footer: z.string().optional(),
  hosted_invoice_url: z.string().optional(),
  invoice_pdf: z.string().optional(),
  lines: z
    .object({
      object: z.string(),
      data: z.array(z.unknown()),
      has_more: z.boolean(),
      total_count: z.number().int(),
      url: z.string(),
    })
    .optional(),
  livemode: z.boolean().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  number: z.string().optional(),
  status: z.string().optional(),
  status_transitions: z
    .object({
      finalized_at: z.number().int().optional(),
      marked_uncollectible_at: z.number().int().optional(),
      paid_at: z.number().int().optional(),
      voided_at: z.number().int().optional(),
    })
    .optional(),
  subtotal: z.number().int().optional(),
  total: z.number().int().optional(),
});

function omitNull<T>(value: T | null | undefined): T | undefined {
  return value === null ? undefined : value;
}

function serializeFormData(data: Record<string, string | number | boolean>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    params.append(key, String(value));
  }
  return params.toString();
}

export function updateInvoiceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_update_invoice',
    description: 'Update an invoice in Stripe.',
    inputSchema: updateInvoiceInputSchema,
    outputSchema: updateInvoiceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateInvoiceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const data: Record<string, string | number | boolean> = {};

      if (input.description !== undefined) {
        data['description'] = input.description;
      }
      if (input.auto_advance !== undefined) {
        data['auto_advance'] = input.auto_advance;
      }
      if (input.collection_method !== undefined) {
        data['collection_method'] = input.collection_method;
      }
      if (input.days_until_due !== undefined) {
        data['days_until_due'] = input.days_until_due;
      }
      if (input.due_date !== undefined) {
        data['due_date'] = input.due_date;
      }
      if (input.footer !== undefined) {
        data['footer'] = input.footer;
      }
      if (input.statement_descriptor !== undefined) {
        data['statement_descriptor'] = input.statement_descriptor;
      }
      if (input.default_payment_method !== undefined) {
        data['default_payment_method'] = input.default_payment_method;
      }
      if (input.metadata !== undefined) {
        for (const [key, value] of Object.entries(input.metadata)) {
          data[`metadata[${key}]`] = value;
        }
      }

      const config: PlatformProxyRequest = {
        // https://docs.stripe.com/api/invoices/update
        endpoint: `/v1/invoices/${encodeURIComponent(input.id)}`,
        data: serializeFormData(data),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        retries: 3,
      };

      const response = await platformProxy.post(config);

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Invoice not found or update failed',
          invoice_id: input.id,
        });
      }

      const providerInvoice = ProviderInvoiceSchema.parse(response.data);

      return {
        id: providerInvoice.id,
        object: omitNull(providerInvoice.object),
        amount_due: omitNull(providerInvoice.amount_due),
        amount_paid: omitNull(providerInvoice.amount_paid),
        amount_remaining: omitNull(providerInvoice.amount_remaining),
        auto_advance: omitNull(providerInvoice.auto_advance),
        billing_reason: omitNull(providerInvoice.billing_reason),
        collection_method: omitNull(providerInvoice.collection_method),
        created: omitNull(providerInvoice.created),
        currency: omitNull(providerInvoice.currency),
        customer: omitNull(providerInvoice.customer),
        description: omitNull(providerInvoice.description),
        due_date: omitNull(providerInvoice.due_date),
        footer: omitNull(providerInvoice.footer),
        hosted_invoice_url: omitNull(providerInvoice.hosted_invoice_url),
        invoice_pdf: omitNull(providerInvoice.invoice_pdf),
        lines: omitNull(providerInvoice.lines),
        livemode: omitNull(providerInvoice.livemode),
        metadata: omitNull(providerInvoice.metadata),
        number: omitNull(providerInvoice.number),
        status: omitNull(providerInvoice.status),
        status_transitions:
          providerInvoice.status_transitions !== null && providerInvoice.status_transitions !== undefined
            ? {
                finalized_at: omitNull(providerInvoice.status_transitions.finalized_at),
                marked_uncollectible_at: omitNull(providerInvoice.status_transitions.marked_uncollectible_at),
                paid_at: omitNull(providerInvoice.status_transitions.paid_at),
                voided_at: omitNull(providerInvoice.status_transitions.voided_at),
              }
            : undefined,
        subtotal: omitNull(providerInvoice.subtotal),
        total: omitNull(providerInvoice.total),
      };
    },
  });
}
