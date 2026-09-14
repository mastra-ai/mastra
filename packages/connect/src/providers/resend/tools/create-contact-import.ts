// AUTO-GENERATED from rhysbalevicius/integration-templates @ 2faa11af97d8 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createContactImportInputSchema = z.object({}).passthrough();

const ProviderResponseSchema = z.object({ object: z.string().optional(), id: z.string().optional() }).passthrough();

export const createContactImportOutputSchema = ProviderResponseSchema;

export function createContactImportTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_create_contact_import',
    description: 'Create a contact import in Resend.',
    inputSchema: createContactImportInputSchema,
    outputSchema: createContactImportOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createContactImportOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/contacts/imports`,
        retries: 0,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
