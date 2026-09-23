// AUTO-GENERATED from rhysbalevicius/integration-templates @ ac255e042871 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getSegmentInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    id: z.string().optional(),
    object: z.string().optional(),
    name: z.string().optional(),
    audience_id: z.string().optional(),
    filter: z.object({}).passthrough().optional(),
    created_at: z.string().optional(),
  })
  .passthrough();

export const getSegmentOutputSchema = ProviderResponseSchema;

export function getSegmentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_get_segment',
    description: 'Retrieve a single segment in Resend.',
    inputSchema: getSegmentInputSchema,
    outputSchema: getSegmentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getSegmentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/segments/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
