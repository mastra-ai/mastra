// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const SubscriptionFilterConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'not_equals']),
  value: z.string(),
});

const SubscriptionFilterSchema = z
  .union([
    z.object({
      $or: z.array(SubscriptionFilterConditionSchema),
    }),
    z.object({
      $and: z.array(SubscriptionFilterConditionSchema),
    }),
  ])
  .nullable();

const SubscriptionSchema = z.object({
  event_type: z.string(),
  filter: SubscriptionFilterSchema,
});

export const updateWebhookInputSchema = z.object({
  webhook_id: z
    .string()
    .uuid()
    .describe('The ID of the webhook to update. Example: "45662666-3a96-4189-9ddb-6d6fe20bd076"'),
  target_url: z
    .string()
    .url()
    .optional()
    .describe('URL where the webhook events will be delivered to. Example: "https://example.com/webhook"'),
  subscriptions: z.array(SubscriptionSchema).optional().describe('One or more events the webhook is subscribed to.'),
});

const ProviderWebhookIdSchema = z.object({
  workspace_id: z.string(),
  webhook_id: z.string(),
});

const ProviderSubscriptionSchema = z.object({
  event_type: z.string(),
  filter: SubscriptionFilterSchema,
});

const ProviderWebhookSchema = z.object({
  target_url: z.string(),
  subscriptions: z.array(ProviderSubscriptionSchema),
  id: ProviderWebhookIdSchema,
  status: z.enum(['active', 'degraded', 'inactive']).or(z.string()),
  created_at: z.string(),
});

const ProviderResponseSchema = z.object({
  data: ProviderWebhookSchema,
});

export const updateWebhookOutputSchema = z.object({
  webhook_id: z.string(),
  workspace_id: z.string(),
  target_url: z.string(),
  subscriptions: z.array(SubscriptionSchema),
  status: z.enum(['active', 'degraded', 'inactive']).or(z.string()),
  created_at: z.string(),
});

export function updateWebhookTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_update_webhook',
    description: 'Update a webhook in Attio.',
    inputSchema: updateWebhookInputSchema,
    outputSchema: updateWebhookOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateWebhookOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const data: { target_url?: string; subscriptions?: z.infer<typeof SubscriptionSchema>[] } = {};

      if (input.target_url !== undefined) {
        data.target_url = input.target_url;
      }

      if (input.subscriptions !== undefined) {
        data.subscriptions = input.subscriptions;
      }

      // https://docs.attio.com/rest-api/endpoint-reference/webhooks/update-a-webhook
      const response = await platformProxy.patch({
        endpoint: `/v2/webhooks/${input.webhook_id}`,
        data: { data },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        webhook_id: providerResponse.data.id.webhook_id,
        workspace_id: providerResponse.data.id.workspace_id,
        target_url: providerResponse.data.target_url,
        subscriptions: providerResponse.data.subscriptions,
        status: providerResponse.data.status,
        created_at: providerResponse.data.created_at,
      };
    },
  });
}
