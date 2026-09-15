// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const deleteWebhookInputSchema = z.object({ webhook_id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({ object: z.string().optional(), id: z.string().optional(), deleted: z.boolean().optional() })
  .passthrough();

export const deleteWebhookOutputSchema = ProviderResponseSchema;

export function deleteWebhookTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_delete_webhook',
    description: 'Remove an existing webhook in Resend.',
    inputSchema: deleteWebhookInputSchema,
    outputSchema: deleteWebhookOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteWebhookOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/webhooks/${encodeURIComponent(input['webhook_id'])}`,
        retries: 3,
      };
      const response = await platformProxy.delete(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
