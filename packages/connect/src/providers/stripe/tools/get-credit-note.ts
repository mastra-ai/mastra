// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getCreditNoteInputSchema = z.object({
  id: z.string().describe('The ID of the credit note to retrieve. Example: "cn_1MxvRqLkdIwHu7ixY0xbUcxk"'),
});

const CreditNoteLineItemSchema = z.object({
  id: z.string(),
  object: z.literal('credit_note_line_item'),
  amount: z.number(),
  description: z.string().optional(),
  discount_amount: z.number().optional(),
  discount_amounts: z.array(z.record(z.string(), z.unknown())).optional(),
  invoice_line_item: z.string().optional(),
  livemode: z.boolean(),
  quantity: z.number().optional(),
  tax_rates: z.array(z.record(z.string(), z.unknown())).optional(),
  taxes: z.array(z.record(z.string(), z.unknown())).optional(),
  type: z.string(),
  unit_amount: z.number().optional(),
  unit_amount_decimal: z.string().optional(),
});

const CreditNoteLinesSchema = z.object({
  object: z.literal('list'),
  data: z.array(CreditNoteLineItemSchema),
  has_more: z.boolean(),
  url: z.string(),
});

const CreditNoteSchema = z.object({
  id: z.string(),
  object: z.literal('credit_note'),
  amount: z.number(),
  amount_shipping: z.number().optional(),
  created: z.number(),
  currency: z.string(),
  customer: z.string().optional(),
  customer_balance_transaction: z.string().nullable().optional(),
  discount_amount: z.number().optional(),
  discount_amounts: z.array(z.record(z.string(), z.unknown())).optional(),
  invoice: z.string().optional(),
  lines: CreditNoteLinesSchema,
  livemode: z.boolean(),
  memo: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  number: z.string().optional(),
  out_of_band_amount: z.number().nullable().optional(),
  pdf: z.string().optional(),
  post_payment_amount: z.number().optional(),
  pre_payment_amount: z.number().optional(),
  reason: z.string().nullable().optional(),
  refunds: z.array(z.record(z.string(), z.unknown())).optional(),
  shipping_cost: z.record(z.string(), z.unknown()).nullable().optional(),
  status: z.string().optional(),
  subtotal: z.number().optional(),
  subtotal_excluding_tax: z.number().optional(),
  total: z.number().optional(),
  total_excluding_tax: z.number().optional(),
  total_taxes: z.array(z.record(z.string(), z.unknown())).optional(),
  type: z.string().optional(),
  voided_at: z.number().nullable().optional(),
});

export const getCreditNoteOutputSchema = CreditNoteSchema;

export function getCreditNoteTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_get_credit_note',
    description: 'Retrieve a single credit note from Stripe.',
    inputSchema: getCreditNoteInputSchema,
    outputSchema: getCreditNoteOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getCreditNoteOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://docs.stripe.com/api/credit_notes/retrieve
        endpoint: `/v1/credit_notes/${encodeURIComponent(input.id)}`,
        retries: 3,
      };

      const response = await platformProxy.get(config);

      const creditNote = CreditNoteSchema.parse(response.data);

      return creditNote;
    },
  });
}
