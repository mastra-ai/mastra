// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createWebhookInputSchema = z.object({
  channelId: z
    .string()
    .optional()
    .describe(
      'The channel ID where the webhook will be created. Can also be provided via metadata. Example: "199737254929760256"',
    ),
  name: z
    .string()
    .min(1)
    .max(80)
    .describe('Name of the webhook (1-80 characters). Must not contain "clyde" or "discord" (case-insensitive).'),
  avatar: z
    .string()
    .nullable()
    .optional()
    .describe(
      'Optional base64-encoded image data for the webhook avatar. Example: "data:image/png;base64,iVBORw0KGgo..."',
    ),
});

const ProviderWebhookSchema = z.object({
  id: z.string(),
  type: z.number(),
  guild_id: z.string().nullable().optional(),
  channel_id: z.string().nullable(),
  user: z
    .object({
      id: z.string(),
      username: z.string(),
      discriminator: z.string(),
      avatar: z.string().nullable(),
      public_flags: z.number(),
    })
    .optional(),
  name: z.string().nullable(),
  avatar: z.string().nullable().optional(),
  token: z.string().optional(),
  application_id: z.string().nullable().optional(),
});

export const createWebhookOutputSchema = z.object({
  id: z.string(),
  type: z.number().describe('Webhook type: 1 = Incoming, 2 = Channel Follower, 3 = Application'),
  guildId: z.string().optional(),
  channelId: z.string().optional(),
  name: z.string().optional(),
  avatar: z.string().optional(),
  token: z.string().optional().describe('Webhook token (only for Incoming webhooks)'),
  applicationId: z.string().optional(),
});

const MetadataSchema = z.object({
  botToken: z.string().describe('Discord bot token for authentication'),
  channelId: z.string().optional().describe('Optional default channel ID for creating webhooks'),
});

export function createWebhookTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_create_webhook',
    description: 'Create a webhook in a Discord channel',
    inputSchema: createWebhookInputSchema,
    outputSchema: createWebhookOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createWebhookOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{
        botToken?: string;
        channelId?: string;
      }>();
      const botToken = metadata?.botToken;
      const channelId = input.channelId ?? metadata?.channelId;

      if (!botToken) {
        throw new platformProxy.ActionError({
          type: 'missing_metadata',
          message: 'botToken is required in connection metadata.',
        });
      }

      if (!channelId) {
        throw new platformProxy.ActionError({
          type: 'missing_channel',
          message: 'channelId is required in input or metadata.',
        });
      }

      const nameLower = input.name.toLowerCase();
      if (nameLower.includes('clyde') || nameLower.includes('discord')) {
        throw new platformProxy.ActionError({
          type: 'invalid_webhook_name',
          message: 'Webhook name cannot contain "clyde" or "discord" (case-insensitive).',
        });
      }

      // https://discord.com/developers/docs/resources/webhook#create-webhook
      const response = await platformProxy.post({
        endpoint: `/api/v10/channels/${channelId}/webhooks`,
        data: {
          name: input.name,
          ...(input.avatar !== undefined && { avatar: input.avatar }),
        },
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        retries: 3,
      });

      const providerWebhook = ProviderWebhookSchema.parse(response.data);

      return {
        id: providerWebhook.id,
        type: providerWebhook.type,
        ...(providerWebhook.guild_id != null && {
          guildId: providerWebhook.guild_id,
        }),
        ...(providerWebhook.channel_id != null && {
          channelId: providerWebhook.channel_id,
        }),
        ...(providerWebhook.name != null && {
          name: providerWebhook.name,
        }),
        ...(providerWebhook.avatar != null && {
          avatar: providerWebhook.avatar,
        }),
        ...(providerWebhook.token && { token: providerWebhook.token }),
        ...(providerWebhook.application_id != null && {
          applicationId: providerWebhook.application_id,
        }),
      };
    },
  });
}
