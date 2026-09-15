// AUTO-GENERATED from rhysbalevicius/integration-templates @ b9fc364318f7 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getAudienceInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    id: z.string().optional(),
    object: z.string().optional(),
    name: z.string().optional(),
    created_at: z.string().optional(),
  })
  .passthrough();

export const getAudienceOutputSchema = ProviderResponseSchema;

export function getAudienceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_get_audience',
    description: 'Retrieve a single audience in Resend.',
    inputSchema: getAudienceInputSchema,
    outputSchema: getAudienceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getAudienceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/audiences/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
