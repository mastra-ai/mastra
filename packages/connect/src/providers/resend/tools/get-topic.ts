// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getTopicInputSchema = z
  .object({ id: z.string().describe('The topic ID. Example: "b6d24b8e-af0b-4c3c-be0c-359bbd97381e"') })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    id: z.string().optional(),
    object: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    default_subscription: z.enum(['opt_in', 'opt_out']).or(z.string()).optional(),
    visibility: z.enum(['public', 'private']).or(z.string()).optional(),
    created_at: z.string().optional(),
  })
  .passthrough();

export const getTopicOutputSchema = ProviderResponseSchema;

export function getTopicTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_get_topic',
    description: 'Retrieve a single topic in Resend.',
    inputSchema: getTopicInputSchema,
    outputSchema: getTopicOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getTopicOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/topics/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
