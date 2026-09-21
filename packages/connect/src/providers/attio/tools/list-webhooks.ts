// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listWebhooksInputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(10)
    .max(100)
    .optional()
    .describe('The maximum number of results to return, between 10 and 100. Defaults to 10.'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const ProviderWebhookIdSchema = z.object({
  workspace_id: z.string(),
  webhook_id: z.string(),
});

const ProviderSubscriptionSchema = z.object({
  event_type: z.string(),
  filter: z.unknown().nullable(),
});

const ProviderWebhookSchema = z.object({
  target_url: z.string(),
  subscriptions: z.array(ProviderSubscriptionSchema),
  id: ProviderWebhookIdSchema,
  status: z.string(),
  created_at: z.string(),
});

const ProviderResponseSchema = z.object({
  data: z.array(ProviderWebhookSchema),
});

const WebhookSchema = z.object({
  id: z.object({
    workspace_id: z.string(),
    webhook_id: z.string(),
  }),
  target_url: z.string(),
  subscriptions: z.array(
    z.object({
      event_type: z.string(),
      filter: z.unknown().nullable(),
    }),
  ),
  status: z.string(),
  created_at: z.string(),
});

export const listWebhooksOutputSchema = z.object({
  items: z.array(WebhookSchema),
  next_cursor: z.string().optional(),
});

export function listWebhooksTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_list_webhooks',
    description: 'List webhooks from Attio.',
    inputSchema: listWebhooksInputSchema,
    outputSchema: listWebhooksOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listWebhooksOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const limit = input.limit ?? 10;
      const offset = input.cursor ? parseInt(input.cursor, 10) : 0;

      if (input.cursor && !/^\d+$/.test(input.cursor)) {
        throw new platformProxy.ActionError({
          type: 'invalid_cursor',
          message: 'cursor must be a valid integer string.',
        });
      }

      const response = await platformProxy.get({
        // https://docs.attio.com/rest-api/endpoint-reference/webhooks/list-webhooks
        endpoint: '/v2/webhooks',
        params: {
          limit: String(limit),
          offset: String(offset),
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      const items = providerResponse.data.map(webhook => ({
        id: webhook.id,
        target_url: webhook.target_url,
        subscriptions: webhook.subscriptions.map(subscription => ({
          event_type: subscription.event_type,
          filter: subscription.filter,
        })),
        status: webhook.status,
        created_at: webhook.created_at,
      }));

      const hasMore = providerResponse.data.length === limit;

      return {
        items,
        ...(hasMore && { next_cursor: String(offset + limit) }),
      };
    },
  });
}
