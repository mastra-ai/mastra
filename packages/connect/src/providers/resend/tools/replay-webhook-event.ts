// AUTO-GENERATED from rhysbalevicius/integration-templates @ ac255e042871 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const replayWebhookEventInputSchema = z.object({ webhook_id: z.string(), event_id: z.string() }).passthrough();

const ProviderResponseSchema = z.object({ object: z.string().optional(), id: z.string().optional() }).passthrough();

export const replayWebhookEventOutputSchema = ProviderResponseSchema;

export function replayWebhookEventTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_replay_webhook_event',
    description: 'Replay a webhook event in Resend.',
    inputSchema: replayWebhookEventInputSchema,
    outputSchema: replayWebhookEventOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof replayWebhookEventOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/webhooks/${encodeURIComponent(input['webhook_id'])}/events/${encodeURIComponent(input['event_id'])}/replay`,
        retries: 0,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
