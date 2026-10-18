// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteInvoiceItemInputSchema = z.object({
  invoice_item_id: z.string().describe('The ID of the invoice item to delete. Example: ii_xxx'),
});

const ProviderResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  deleted: z.boolean(),
});

export const deleteInvoiceItemOutputSchema = z.object({
  id: z.string(),
  deleted: z.boolean(),
});

export function deleteInvoiceItemTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_delete_invoice_item',
    description: 'Delete an invoice item from Stripe.',
    inputSchema: deleteInvoiceItemInputSchema,
    outputSchema: deleteInvoiceItemOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteInvoiceItemOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.stripe.com/api/invoiceitems/delete
      const response = await platformProxy.delete({
        endpoint: `/v1/invoiceitems/${encodeURIComponent(input.invoice_item_id)}`,
        retries: 1,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        id: providerResponse.id,
        deleted: providerResponse.deleted,
      };
    },
  });
}
