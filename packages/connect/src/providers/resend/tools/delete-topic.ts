// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const deleteTopicInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({ id: z.string().optional(), object: z.string().optional(), deleted: z.boolean().optional() })
  .passthrough();

export const deleteTopicOutputSchema = ProviderResponseSchema;

export function deleteTopicTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_delete_topic',
    description: 'Remove an existing topic in Resend.',
    inputSchema: deleteTopicInputSchema,
    outputSchema: deleteTopicOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteTopicOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/topics/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.delete(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
