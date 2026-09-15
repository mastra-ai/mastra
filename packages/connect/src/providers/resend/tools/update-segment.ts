// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const updateSegmentInputSchema = z
  .object({ id: z.string(), body: z.object({ name: z.string() }).passthrough() })
  .passthrough();

const ProviderResponseSchema = z.object({ id: z.string().optional(), object: z.string().optional() }).passthrough();

export const updateSegmentOutputSchema = ProviderResponseSchema;

export function updateSegmentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_update_segment',
    description: 'Update an existing segment in Resend.',
    inputSchema: updateSegmentInputSchema,
    outputSchema: updateSegmentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateSegmentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/segments/${encodeURIComponent(input['id'])}`,
        retries: 3,
        data: input.body,
      };
      const response = await platformProxy.patch(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
