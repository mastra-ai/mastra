// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listWebhooksInputSchema = z.object({
  channelId: z.string().describe('Discord channel ID. Example: "1504364254634180618"'),
});

const WebhookSchema = z.object({
  id: z.string(),
  type: z.number().int(),
  guild_id: z.string().optional(),
  channel_id: z.string().optional(),
  name: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  token: z.string().optional(),
  application_id: z.string().nullable().optional(),
  user: z
    .object({
      id: z.string(),
      username: z.string(),
      discriminator: z.string(),
      avatar: z.string().nullable().optional(),
      bot: z.boolean().optional(),
    })
    .optional(),
  source_guild: z
    .object({
      id: z.string(),
      name: z.string(),
      icon: z.string().nullable().optional(),
    })
    .optional(),
  source_channel: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  url: z.string().optional(),
});

export const listWebhooksOutputSchema = z.object({
  webhooks: z.array(WebhookSchema),
});

const MetadataSchema = z.object({
  botToken: z.string(),
});

export function listWebhooksTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_list_webhooks',
    description: 'List webhooks from a Discord channel',
    inputSchema: listWebhooksInputSchema,
    outputSchema: listWebhooksOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listWebhooksOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<z.infer<typeof MetadataSchema>>();

      if (!metadata?.botToken) {
        throw new platformProxy.ActionError({
          type: 'missing_bot_token',
          message: 'Bot token is required in connection metadata.',
        });
      }

      // https://discord.com/developers/docs/resources/webhook#list-channel-webhooks
      const response = await platformProxy.get({
        endpoint: `/api/v10/channels/${input.channelId}/webhooks`,
        headers: {
          Authorization: `Bot ${metadata.botToken}`,
        },
        retries: 3,
      });

      const webhooks = z.array(WebhookSchema).parse(response.data);

      return {
        webhooks: webhooks,
      };
    },
  });
}
