// AUTO-GENERATED from rhysbalevicius/integration-templates @ 2faa11af97d8 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const cancelBroadcastInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z.object({ id: z.string().optional(), object: z.string().optional() }).passthrough();

export const cancelBroadcastOutputSchema = ProviderResponseSchema;

export function cancelBroadcastTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_cancel_broadcast',
    description: 'Cancel a broadcast in Resend.',
    inputSchema: cancelBroadcastInputSchema,
    outputSchema: cancelBroadcastOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof cancelBroadcastOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/broadcasts/${encodeURIComponent(input['id'])}/cancel`,
        retries: 0,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
