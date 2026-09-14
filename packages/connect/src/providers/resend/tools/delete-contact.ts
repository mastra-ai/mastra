// AUTO-GENERATED from rhysbalevicius/integration-templates @ 2faa11af97d8 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const deleteContactInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({ object: z.string().optional(), id: z.string().optional(), deleted: z.boolean().optional() })
  .passthrough();

export const deleteContactOutputSchema = ProviderResponseSchema;

export function deleteContactTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_delete_contact',
    description: 'Remove an existing contact by ID or email in Resend.',
    inputSchema: deleteContactInputSchema,
    outputSchema: deleteContactOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteContactOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/contacts/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.delete(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
