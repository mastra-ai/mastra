// AUTO-GENERATED from rhysbalevicius/integration-templates @ 2faa11af97d8 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getWebhookEventInputSchema = z.object({ webhook_id: z.string(), event_id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    id: z.string().optional(),
    type: z.string().optional(),
    created_at: z.string().optional(),
    status: z.enum(['pending', 'attempting', 'success', 'failed']).optional(),
    next_attempt_at: z.string().nullable().optional(),
    payload: z.object({}).passthrough().optional(),
  })
  .passthrough();

export const getWebhookEventOutputSchema = ProviderResponseSchema;

export function getWebhookEventTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_get_webhook_event',
    description: 'Retrieve a single webhook event in Resend.',
    inputSchema: getWebhookEventInputSchema,
    outputSchema: getWebhookEventOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getWebhookEventOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/webhooks/${encodeURIComponent(input['webhook_id'])}/events/${encodeURIComponent(input['event_id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
