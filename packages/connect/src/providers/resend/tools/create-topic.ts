// AUTO-GENERATED from rhysbalevicius/integration-templates @ ac255e042871 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createTopicInputSchema = z
  .object({
    body: z
      .object({
        name: z.string().max(50),
        default_subscription: z.enum(['opt_in', 'opt_out']),
        description: z.string().max(200).optional(),
        visibility: z.enum(['public', 'private']).optional(),
      })
      .passthrough(),
  })
  .passthrough();

const ProviderResponseSchema = z.object({ id: z.string().optional(), object: z.string().optional() }).passthrough();

export const createTopicOutputSchema = ProviderResponseSchema;

export function createTopicTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_create_topic',
    description: 'Create a new topic in Resend.',
    inputSchema: createTopicInputSchema,
    outputSchema: createTopicOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createTopicOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/topics`,
        retries: 0,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
