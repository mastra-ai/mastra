// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const voidCreditNoteInputSchema = z.object({
  credit_note_id: z.string().min(1).describe('The ID of the credit note to void. Example: "cn_xxx"'),
});

export const voidCreditNoteOutputSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    amount: z.number().optional(),
    created: z.number().optional(),
    currency: z.string().optional(),
    customer: z.string().optional(),
    customer_balance_transaction: z.string().nullable().optional(),
    discount_amount: z.number().optional(),
    discount_amounts: z.array(z.record(z.string(), z.unknown())).optional(),
    invoice: z.string().optional(),
    lines: z.record(z.string(), z.unknown()).optional(),
    livemode: z.boolean().optional(),
    memo: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    number: z.string().nullable().optional(),
    out_of_band_amount: z.number().nullable().optional(),
    pdf: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    refund: z.string().nullable().optional(),
    status: z.string().optional(),
    subtotal: z.number().optional(),
    subtotal_excluding_tax: z.number().optional(),
    tax_amounts: z.array(z.record(z.string(), z.unknown())).optional(),
    total: z.number().optional(),
    total_excluding_tax: z.number().optional(),
    type: z.string().optional(),
    voided_at: z.number().nullable().optional(),
    voided_reason: z.string().nullable().optional(),
  })
  .passthrough();

export function voidCreditNoteTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_void_credit_note',
    description: 'Void a Stripe credit note.',
    inputSchema: voidCreditNoteInputSchema,
    outputSchema: voidCreditNoteOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof voidCreditNoteOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.stripe.com/api/credit_notes/void
        endpoint: `/v1/credit_notes/${encodeURIComponent(input.credit_note_id)}/void`,
        retries: 3,
      });

      const creditNote = voidCreditNoteOutputSchema.parse(response.data);
      return creditNote;
    },
  });
}
