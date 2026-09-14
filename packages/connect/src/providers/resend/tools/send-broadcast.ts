// AUTO-GENERATED from rhysbalevicius/integration-templates @ 2faa11af97d8 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const sendBroadcastInputSchema = z
  .object({ id: z.string(), body: z.object({ scheduled_at: z.string().optional() }).passthrough() })
  .passthrough();

const ProviderResponseSchema = z.object({ id: z.string().optional() }).passthrough();

export const sendBroadcastOutputSchema = ProviderResponseSchema;

export function sendBroadcastTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_send_broadcast',
    description: 'Send or schedule a broadcast in Resend.',
    inputSchema: sendBroadcastInputSchema,
    outputSchema: sendBroadcastOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof sendBroadcastOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/broadcasts/${encodeURIComponent(input['id'])}/send`,
        retries: 0,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
