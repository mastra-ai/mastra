// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getWebhookInputSchema = z.object({
  webhookId: z.string().describe('The ID of the webhook to retrieve. Example: "123456789012345678"'),
});

const ProviderWebhookSchema = z.object({
  id: z.string(),
  type: z.number().int(),
  guild_id: z.string().optional(),
  channel_id: z.string().optional(),
  name: z.string().optional().nullable(),
  avatar: z.string().optional().nullable(),
  token: z.string().optional(),
  application_id: z.string().optional().nullable(),
  user: z
    .object({
      id: z.string(),
      username: z.string(),
      discriminator: z.string(),
      avatar: z.string().optional().nullable(),
      bot: z.boolean().optional(),
    })
    .optional(),
  url: z.string().optional(),
});

export const getWebhookOutputSchema = z.object({
  id: z.string().describe('The ID of the webhook.'),
  type: z.number().int().describe('The type of the webhook (1 = Incoming, 2 = Channel Follower).'),
  guildId: z.string().optional().describe('The guild ID this webhook is for.'),
  channelId: z.string().optional().describe('The channel ID this webhook is for.'),
  name: z.string().optional().describe('The default name of the webhook.'),
  avatar: z.string().optional().describe('The default user avatar hash of the webhook.'),
  token: z.string().optional().describe('The secure token of the webhook (returned for incoming webhooks).'),
  applicationId: z.string().optional().describe('The application that created this webhook.'),
  user: z
    .object({
      id: z.string(),
      username: z.string(),
      discriminator: z.string(),
      avatar: z.string().optional(),
      bot: z.boolean().optional(),
    })
    .optional()
    .describe('The user that created this webhook.'),
  url: z.string().optional().describe('The URL used for executing the webhook (returned for incoming webhooks).'),
});

export function getWebhookTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_get_webhook',
    description: 'Retrieve a single webhook from Discord.',
    inputSchema: getWebhookInputSchema,
    outputSchema: getWebhookOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getWebhookOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ botToken: string }>();

      if (!metadata?.botToken) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in connection metadata.',
        });
      }

      // https://discord.com/developers/docs/resources/webhook#get-webhook
      const response = await platformProxy.get({
        endpoint: `/api/v10/webhooks/${input.webhookId}`,
        headers: {
          Authorization: `Bot ${metadata.botToken}`,
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Webhook with ID ${input.webhookId} not found.`,
          webhookId: input.webhookId,
        });
      }

      const providerWebhook = ProviderWebhookSchema.parse(response.data);

      return {
        id: providerWebhook.id,
        type: providerWebhook.type,
        ...(providerWebhook.guild_id !== undefined && { guildId: providerWebhook.guild_id }),
        ...(providerWebhook.channel_id !== undefined && { channelId: providerWebhook.channel_id }),
        ...(providerWebhook.name !== undefined && providerWebhook.name !== null && { name: providerWebhook.name }),
        ...(providerWebhook.avatar !== undefined &&
          providerWebhook.avatar !== null && { avatar: providerWebhook.avatar }),
        ...(providerWebhook.token !== undefined && { token: providerWebhook.token }),
        ...(providerWebhook.application_id !== undefined &&
          providerWebhook.application_id !== null && { applicationId: providerWebhook.application_id }),
        ...(providerWebhook.user !== undefined && {
          user: {
            id: providerWebhook.user.id,
            username: providerWebhook.user.username,
            discriminator: providerWebhook.user.discriminator,
            ...(providerWebhook.user.avatar !== undefined &&
              providerWebhook.user.avatar !== null && { avatar: providerWebhook.user.avatar }),
            ...(providerWebhook.user.bot !== undefined && { bot: providerWebhook.user.bot }),
          },
        }),
        ...(providerWebhook.url !== undefined && { url: providerWebhook.url }),
      };
    },
  });
}
