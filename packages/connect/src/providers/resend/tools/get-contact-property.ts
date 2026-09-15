// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getContactPropertyInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    id: z.string(),
    key: z.string(),
    type: z.enum(['string', 'number']).or(z.string()),
    fallback_value: z.union([z.string(), z.number()]).optional(),
    created_at: z.string().optional(),
  })
  .passthrough();

export const getContactPropertyOutputSchema = ProviderResponseSchema;

export function getContactPropertyTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_get_contact_property',
    description: 'Retrieve a single contact property in Resend.',
    inputSchema: getContactPropertyInputSchema,
    outputSchema: getContactPropertyOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getContactPropertyOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/contact-properties/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
