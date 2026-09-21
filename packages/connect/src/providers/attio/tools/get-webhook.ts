// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getWebhookInputSchema = z.object({
  webhook_id: z
    .string()
    .describe('A UUID which identifies the webhook. Example: "23e42eaf-323a-41da-b5bb-fd67eebda553"'),
});

const FilterConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'not_equals']).or(z.string()),
  value: z.string(),
});

const FilterSchema = z
  .union([
    z.object({
      $or: z.array(FilterConditionSchema),
    }),
    z.object({
      $and: z.array(FilterConditionSchema),
    }),
  ])
  .nullable();

const SubscriptionSchema = z.object({
  event_type: z.string(),
  filter: FilterSchema,
});

const WebhookIdSchema = z.object({
  workspace_id: z.string(),
  webhook_id: z.string(),
});

const ProviderWebhookSchema = z.object({
  target_url: z.string(),
  subscriptions: z.array(SubscriptionSchema),
  id: WebhookIdSchema,
  status: z.enum(['active', 'degraded', 'inactive']).or(z.string()),
  created_at: z.string(),
});

const ProviderResponseSchema = z.object({
  data: ProviderWebhookSchema,
});

export const getWebhookOutputSchema = z.object({
  id: z.object({
    workspace_id: z.string(),
    webhook_id: z.string(),
  }),
  target_url: z.string(),
  subscriptions: z.array(
    z.object({
      event_type: z.string(),
      filter: z
        .union([
          z.object({
            $or: z.array(
              z.object({
                field: z.string(),
                operator: z.enum(['equals', 'not_equals']).or(z.string()),
                value: z.string(),
              }),
            ),
          }),
          z.object({
            $and: z.array(
              z.object({
                field: z.string(),
                operator: z.enum(['equals', 'not_equals']).or(z.string()),
                value: z.string(),
              }),
            ),
          }),
        ])
        .nullable(),
    }),
  ),
  status: z.enum(['active', 'degraded', 'inactive']).or(z.string()),
  created_at: z.string(),
});

export function getWebhookTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_get_webhook',
    description: 'Retrieve a single webhook from Attio.',
    inputSchema: getWebhookInputSchema,
    outputSchema: getWebhookOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getWebhookOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.attio.com/rest-api/endpoint-reference/webhooks/get-a-webhook
        endpoint: `/v2/webhooks/${input.webhook_id}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Webhook with ID "${input.webhook_id}" was not found.`,
        });
      }

      const providerResponse = ProviderResponseSchema.parse(response.data);
      const webhook = providerResponse.data;

      return {
        id: {
          workspace_id: webhook.id.workspace_id,
          webhook_id: webhook.id.webhook_id,
        },
        target_url: webhook.target_url,
        subscriptions: webhook.subscriptions.map(sub => ({
          event_type: sub.event_type,
          filter: sub.filter,
        })),
        status: webhook.status,
        created_at: webhook.created_at,
      };
    },
  });
}
