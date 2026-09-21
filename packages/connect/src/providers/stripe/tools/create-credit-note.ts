// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createCreditNoteInputSchema = z.object({
  invoice: z.string().describe('ID of the invoice to credit. Example: in_xxx'),
  amount: z.number().int().optional().describe('Total amount of the credit note in the smallest currency unit.'),
  lines: z
    .array(
      z.object({
        type: z.enum(['invoice_line_item', 'custom_line_item']),
        amount: z.number().int().optional(),
        description: z.string().optional(),
        invoice_line_item: z.string().optional(),
        quantity: z.number().int().optional(),
        unit_amount: z.number().int().optional(),
        unit_amount_decimal: z.string().optional(),
        tax_rates: z.array(z.string()).optional(),
      }),
    )
    .optional()
    .describe('Line items that make up the credit note.'),
  reason: z.enum(['duplicate', 'fraudulent', 'order_change', 'product_unsatisfactory']).optional(),
  memo: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  credit_amount: z.number().int().optional(),
  out_of_band_amount: z.number().int().optional(),
  refund_amount: z.number().int().optional(),
  effective_at: z.number().int().optional(),
  email_type: z.enum(['credit_note', 'none']).optional(),
});

const ProviderCreditNoteLineItemSchema = z.object({
  id: z.string(),
  object: z.string(),
  amount: z.number().int(),
  description: z.string().nullable().optional(),
  discount_amount: z.number().int().optional(),
  discount_amounts: z.array(z.unknown()).optional(),
  invoice_line_item: z.string().optional(),
  livemode: z.boolean().optional(),
  quantity: z.number().int().optional(),
  tax_rates: z.array(z.unknown()).optional(),
  taxes: z.array(z.unknown()).optional(),
  type: z.string(),
  unit_amount: z.number().int().optional(),
  unit_amount_decimal: z.string().optional(),
});

const ProviderLinesSchema = z.object({
  object: z.string(),
  data: z.array(ProviderCreditNoteLineItemSchema),
  has_more: z.boolean(),
  url: z.string(),
});

const ProviderCreditNoteSchema = z.object({
  id: z.string(),
  object: z.string(),
  amount: z.number().int(),
  amount_shipping: z.number().int().optional(),
  created: z.number().int().optional(),
  currency: z.string().optional(),
  customer: z.string().optional(),
  customer_balance_transaction: z.string().nullable().optional(),
  discount_amount: z.number().int().optional(),
  discount_amounts: z.array(z.unknown()).optional(),
  invoice: z.string().optional(),
  lines: ProviderLinesSchema.optional(),
  livemode: z.boolean().optional(),
  memo: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.string()).nullable().optional(),
  number: z.string().optional(),
  out_of_band_amount: z.number().int().nullable().optional(),
  pdf: z.string().nullable().optional(),
  pre_payment_amount: z.number().int().optional(),
  post_payment_amount: z.number().int().optional(),
  reason: z.string().nullable().optional(),
  refunds: z.array(z.unknown()).optional(),
  shipping_cost: z.unknown().nullable().optional(),
  status: z.string().optional(),
  subtotal: z.number().int().optional(),
  subtotal_excluding_tax: z.number().int().optional(),
  total: z.number().int().optional(),
  total_excluding_tax: z.number().int().optional(),
  total_taxes: z.array(z.unknown()).optional(),
  type: z.string().optional(),
  voided_at: z.number().int().nullable().optional(),
});

export const createCreditNoteOutputSchema = ProviderCreditNoteSchema;

function flattenObject(obj: unknown, prefix = ''): Array<[string, string]> {
  if (typeof obj !== 'object' || obj === null) {
    return [];
  }
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          entries.push(...flattenObject(item, `${newKey}[${index}]`));
        } else {
          entries.push([`${newKey}[${index}]`, String(item)]);
        }
      });
    } else if (typeof value === 'object') {
      entries.push(...flattenObject(value, newKey));
    } else {
      entries.push([newKey, String(value)]);
    }
  }
  return entries;
}

export function createCreditNoteTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_create_credit_note',
    description: 'Create a credit note in Stripe to adjust or refund a finalized invoice.',
    inputSchema: createCreditNoteInputSchema,
    outputSchema: createCreditNoteOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createCreditNoteOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const payload: Record<string, unknown> = {
        invoice: input['invoice'],
      };

      if (input['amount'] !== undefined) {
        payload['amount'] = input['amount'];
      }
      if (input['lines'] !== undefined && input['lines'].length > 0) {
        payload['lines'] = input['lines'].map(line => {
          const linePayload: Record<string, unknown> = {
            type: line['type'],
          };
          if (line['amount'] !== undefined) {
            linePayload['amount'] = line['amount'];
          }
          if (line['description'] !== undefined) {
            linePayload['description'] = line['description'];
          }
          if (line['invoice_line_item'] !== undefined) {
            linePayload['invoice_line_item'] = line['invoice_line_item'];
          }
          if (line['quantity'] !== undefined) {
            linePayload['quantity'] = line['quantity'];
          }
          if (line['unit_amount'] !== undefined) {
            linePayload['unit_amount'] = line['unit_amount'];
          }
          if (line['unit_amount_decimal'] !== undefined) {
            linePayload['unit_amount_decimal'] = line['unit_amount_decimal'];
          }
          if (line['tax_rates'] !== undefined) {
            linePayload['tax_rates'] = line['tax_rates'];
          }
          return linePayload;
        });
      }
      if (input['reason'] !== undefined) {
        payload['reason'] = input['reason'];
      }
      if (input['memo'] !== undefined) {
        payload['memo'] = input['memo'];
      }
      if (input['metadata'] !== undefined) {
        payload['metadata'] = input['metadata'];
      }
      if (input['credit_amount'] !== undefined) {
        payload['credit_amount'] = input['credit_amount'];
      }
      if (input['out_of_band_amount'] !== undefined) {
        payload['out_of_band_amount'] = input['out_of_band_amount'];
      }
      if (input['refund_amount'] !== undefined) {
        payload['refund_amount'] = input['refund_amount'];
      }
      if (input['effective_at'] !== undefined) {
        payload['effective_at'] = input['effective_at'];
      }
      if (input['email_type'] !== undefined) {
        payload['email_type'] = input['email_type'];
      }

      const body = flattenObject(payload)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');

      const response = await platformProxy.post({
        // https://docs.stripe.com/api/credit_notes/create
        endpoint: '/v1/credit_notes',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: body,
        retries: 3,
      });

      const creditNote = ProviderCreditNoteSchema.parse(response.data);
      return creditNote;
    },
  });
}
