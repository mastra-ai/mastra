// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listWebhookEventsInputSchema = z
  .object({ webhook_id: z.string(), limit: z.number().int().min(1).max(100).optional(), after: z.string().optional() })
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
            type: z.string().optional(),
            created_at: z.string().optional(),
            status: z.enum(['pending', 'attempting', 'success', 'failed']).optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const listWebhookEventsOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listWebhookEventsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_list_webhook_events',
    description:
      'Retrieve a list of webhook events in Resend. Returns one page; pass next_cursor as after to continue.',
    inputSchema: listWebhookEventsInputSchema,
    outputSchema: listWebhookEventsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listWebhookEventsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['limit'] !== undefined)
        params['limit'] = Array.isArray(input['limit']) ? input['limit'].join(',') : String(input['limit']);
      if (input['after'] !== undefined)
        params['after'] = Array.isArray(input['after']) ? input['after'].join(',') : String(input['after']);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/webhooks/${encodeURIComponent(input['webhook_id'])}/events`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.has_more ? data.data?.at(-1)?.id : undefined };
    },
  });
}
