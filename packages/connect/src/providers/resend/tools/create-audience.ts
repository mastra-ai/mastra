// AUTO-GENERATED from rhysbalevicius/integration-templates @ ac255e042871 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createAudienceInputSchema = z.object({ body: z.object({ name: z.string() }).passthrough() }).passthrough();

const ProviderResponseSchema = z
  .object({ id: z.string().optional(), object: z.string().optional(), name: z.string().optional() })
  .passthrough();

export const createAudienceOutputSchema = ProviderResponseSchema;

export function createAudienceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_create_audience',
    description: 'Create an audience in Resend.',
    inputSchema: createAudienceInputSchema,
    outputSchema: createAudienceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createAudienceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/audiences`,
        retries: 0,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
