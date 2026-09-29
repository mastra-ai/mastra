// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteChannelInputSchema = z.object({
  channelId: z.string().describe('The ID of the channel to delete. Example: "41771983423143937"'),
});

const ProviderChannelSchema = z.object({
  id: z.string(),
  type: z.number(),
  guild_id: z.string().optional(),
  name: z.string().nullable().optional(),
  position: z.number().optional(),
  permission_overwrites: z.array(z.unknown()).optional(),
  rate_limit_per_user: z.number().optional(),
  nsfw: z.boolean().optional(),
  topic: z.string().nullable().optional(),
  last_message_id: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
  default_auto_archive_duration: z.number().optional(),
  bitrate: z.number().optional(),
  user_limit: z.number().optional(),
  rtc_region: z.string().nullable().optional(),
  video_quality_mode: z.number().optional(),
  owner_id: z.string().optional(),
  application_id: z.string().optional(),
  managed: z.boolean().optional(),
  icon: z.string().nullable().optional(),
  message_count: z.number().optional(),
  member_count: z.number().optional(),
  thread_metadata: z
    .object({
      archived: z.boolean(),
      auto_archive_duration: z.number(),
      archive_timestamp: z.string(),
      locked: z.boolean(),
      invitable: z.boolean().optional(),
      create_timestamp: z.string().nullable().optional(),
    })
    .optional(),
  flags: z.number().optional(),
  total_message_sent: z.number().optional(),
});

export const deleteChannelOutputSchema = z.object({
  id: z.string(),
  type: z.number(),
  guildId: z.string().optional(),
  name: z.string().optional(),
  deleted: z.boolean(),
});

export function deleteChannelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_delete_channel',
    description: 'Delete or archive a channel in Discord',
    inputSchema: deleteChannelInputSchema,
    outputSchema: deleteChannelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteChannelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ botToken?: string }>();
      const botToken = metadata?.botToken;

      if (!botToken) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in metadata. Please provide a Discord bot token.',
        });
      }

      // https://discord.com/developers/docs/resources/channel#deleteclose-channel
      const response = await platformProxy.delete({
        endpoint: `/api/v10/channels/${input.channelId}`,
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        retries: 10,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: 'Failed to delete channel - no response from Discord API',
          channelId: input.channelId,
        });
      }

      const providerChannel = ProviderChannelSchema.parse(response.data);

      return {
        id: providerChannel.id,
        type: providerChannel.type,
        ...(providerChannel.guild_id !== undefined && { guildId: providerChannel.guild_id }),
        ...(providerChannel.name != null && { name: providerChannel.name }),
        deleted: true,
      };
    },
  });
}
