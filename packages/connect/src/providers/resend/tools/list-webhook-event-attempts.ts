// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listWebhookEventAttemptsInputSchema = z
  .object({
    webhook_id: z.string(),
    event_id: z.string(),
    limit: z.number().int().min(1).max(100).optional(),
    after: z.string().optional(),
  })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    has_more: z.boolean().optional(),
    data: z
      .array(
        z
          .object({
            id: z.string().optional(),
            http_status_code: z.number().int().optional(),
            response: z.string().optional(),
            sent_at: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const listWebhookEventAttemptsOutputSchema = ProviderResponseSchema.extend({
  next_cursor: z.string().optional(),
});

export function listWebhookEventAttemptsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_list_webhook_event_attempts',
    description:
      'Retrieve a list of webhook event attempts in Resend. Returns one page; pass next_cursor as after to continue.',
    inputSchema: listWebhookEventAttemptsInputSchema,
    outputSchema: listWebhookEventAttemptsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listWebhookEventAttemptsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['limit'] !== undefined) params['limit'] = String(input['limit']);
      if (input['after'] !== undefined) params['after'] = String(input['after']);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/webhooks/${encodeURIComponent(input['webhook_id'])}/events/${encodeURIComponent(input['event_id'])}/attempts`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.has_more ? data.data?.at(-1)?.id : undefined };
    },
  });
}
