// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteWebhookInputSchema = z.object({
  webhookId: z.string().describe('The ID of the webhook to delete. Example: "223704706495545344"'),
});

export const deleteWebhookOutputSchema = z.object({
  success: z.boolean().describe('Whether the webhook was successfully deleted'),
  webhookId: z.string().describe('The ID of the deleted webhook'),
});

export function deleteWebhookTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_delete_webhook',
    description: 'Delete a webhook in Discord permanently',
    inputSchema: deleteWebhookInputSchema,
    outputSchema: deleteWebhookOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteWebhookOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ botToken?: string }>();
      const botToken = metadata?.botToken;

      if (!botToken) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in metadata. Please ensure the Discord connection has a botToken configured.',
        });
      }

      // https://discord.com/developers/docs/resources/webhook#delete-webhook
      const response = await platformProxy.delete({
        endpoint: `/api/v10/webhooks/${input.webhookId}`,
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        retries: 3,
      });

      if (response.status !== 204) {
        throw new platformProxy.ActionError({
          type: 'delete_failed',
          message: 'Failed to delete webhook',
          webhookId: input.webhookId,
          status: response.status,
        });
      }

      return {
        success: true,
        webhookId: input.webhookId,
      };
    },
  });
}
