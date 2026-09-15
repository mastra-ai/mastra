// AUTO-GENERATED from rhysbalevicius/integration-templates @ b9fc364318f7 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const updateTopicInputSchema = z
  .object({
    id: z.string(),
    body: z
      .object({
        name: z.string().max(50).optional(),
        description: z.string().max(200).optional(),
        visibility: z.enum(['public', 'private']).optional(),
      })
      .passthrough(),
  })
  .passthrough();

const ProviderResponseSchema = z.object({ id: z.string().optional(), object: z.string().optional() }).passthrough();

export const updateTopicOutputSchema = ProviderResponseSchema;

export function updateTopicTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_update_topic',
    description: 'Update an existing topic in Resend.',
    inputSchema: updateTopicInputSchema,
    outputSchema: updateTopicOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateTopicOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/topics/${encodeURIComponent(input['id'])}`,
        retries: 3,
        data: input.body,
      };
      const response = await platformProxy.patch(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
