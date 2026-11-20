// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const deleteInvoiceInputSchema = z.object({
  id: z.string().describe('The ID of the draft invoice to delete. Example: "in_1TbSq0EZpD6kXraeoLevMdFv"'),
});

const ProviderResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  deleted: z.boolean(),
});

export const deleteInvoiceOutputSchema = z.object({
  id: z.string(),
  deleted: z.boolean(),
});

export function deleteInvoiceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'stripe_delete_invoice',
    description: 'Delete or archive a invoice in Stripe.',
    inputSchema: deleteInvoiceInputSchema,
    outputSchema: deleteInvoiceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteInvoiceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://docs.stripe.com/api/invoices/delete
        endpoint: `/v1/invoices/${encodeURIComponent(input.id)}`,
        retries: 3,
      };

      const response = await platformProxy.delete(config);

      const providerData = ProviderResponseSchema.parse(response.data);

      return {
        id: providerData.id,
        deleted: providerData.deleted,
      };
    },
  });
}
