// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const deleteContactPropertyInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({ id: z.string().optional(), object: z.string().optional(), deleted: z.boolean().optional() })
  .passthrough();

export const deleteContactPropertyOutputSchema = ProviderResponseSchema;

export function deleteContactPropertyTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_delete_contact_property',
    description: 'Remove an existing contact property in Resend.',
    inputSchema: deleteContactPropertyInputSchema,
    outputSchema: deleteContactPropertyOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteContactPropertyOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/contact-properties/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.delete(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
