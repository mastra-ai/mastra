// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getContactInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    id: z.string().optional(),
    email: z.string().optional(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    created_at: z.string().optional(),
    unsubscribed: z.boolean().optional(),
    properties: z.object({}).passthrough().optional(),
  })
  .passthrough();

export const getContactOutputSchema = ProviderResponseSchema;

export function getContactTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_get_contact',
    description: 'Retrieve a single contact by ID or email in Resend.',
    inputSchema: getContactInputSchema,
    outputSchema: getContactOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getContactOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/contacts/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
