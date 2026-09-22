// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const MetadataSchema = z.object({
  botToken: z.string().describe('Discord bot token from the Discord Developer Portal'),
});

export const createChannelInputSchema = z.object({
  guildId: z.string().describe('The ID of the guild to create the channel in. Example: "41771983423143937"'),
  name: z.string().min(1).max(100).describe('Channel name (1-100 characters). Example: "general"'),
  type: z
    .number()
    .optional()
    .describe(
      'The type of channel. Default is 0 (GUILD_TEXT). Options: 0 (GUILD_TEXT), 2 (GUILD_VOICE), 4 (GUILD_CATEGORY), 5 (GUILD_ANNOUNCEMENT), 13 (GUILD_STAGE_VOICE), 15 (GUILD_FORUM), 16 (GUILD_MEDIA).',
    ),
  topic: z.string().optional().describe('Channel topic (0-1024 characters).'),
  bitrate: z.number().optional().describe('The bitrate of the voice channel (min 8000).'),
  userLimit: z.number().optional().describe('The user limit of the voice channel.'),
  rateLimitPerUser: z
    .number()
    .optional()
    .describe('Amount of seconds a user has to wait before sending another message (0-21600).'),
  position: z.number().optional().describe('Sorting position of the channel.'),
  permissionOverwrites: z.array(z.unknown()).optional(),
  parentId: z.string().optional().describe('ID of the parent category for the channel.'),
  nsfw: z.boolean().optional().describe('Whether the channel is age-restricted.'),
  rtcRegion: z.string().nullable().optional().describe('Channel voice region id, automatic when set to null.'),
  videoQualityMode: z.number().optional().describe('Camera video quality mode (1 for auto, 2 for 720p).'),
  defaultAutoArchiveDuration: z
    .number()
    .optional()
    .describe('Default duration in minutes for newly created threads (60, 1440, 4320, 10080).'),
  defaultReactionEmoji: z.object({}).passthrough().optional(),
  availableTags: z.array(z.unknown()).optional(),
  defaultSortOrder: z
    .number()
    .optional()
    .describe('Default sort order for forum/media channels (0 for latest activity, 1 for creation date).'),
  defaultForumLayout: z.number().optional().describe('Default forum layout (0 not set, 1 list view, 2 gallery view).'),
  defaultThreadRateLimitPerUser: z
    .number()
    .optional()
    .describe('Initial rate limit per user for newly created threads.'),
});

const ProviderChannelSchema = z
  .object({
    id: z.string(),
    guild_id: z.string().optional(),
    name: z.string().optional(),
    type: z.number(),
    position: z.number().optional(),
    permission_overwrites: z.array(z.unknown()).optional(),
    topic: z.string().nullable().optional(),
    nsfw: z.boolean().optional(),
    last_message_id: z.string().nullable().optional(),
    bitrate: z.number().optional(),
    user_limit: z.number().optional(),
    rate_limit_per_user: z.number().optional(),
    parent_id: z.string().nullable().optional(),
    rtc_region: z.string().nullable().optional(),
    video_quality_mode: z.number().optional(),
    default_auto_archive_duration: z.number().optional(),
    flags: z.number().optional(),
    available_tags: z.array(z.unknown()).optional(),
    default_reaction_emoji: z.object({}).passthrough().optional(),
    default_sort_order: z.number().nullable().optional(),
    default_forum_layout: z.number().optional(),
    default_thread_rate_limit_per_user: z.number().optional(),
  })
  .passthrough();

export const createChannelOutputSchema = z.object({
  id: z.string().describe('The ID of the created channel'),
  guildId: z.string().optional().describe('The ID of the guild the channel belongs to'),
  name: z.string().optional().describe('The name of the channel'),
  type: z.number().describe('The type of the channel'),
  position: z.number().optional().describe('The sorting position of the channel'),
  topic: z.string().optional().describe('The channel topic'),
  nsfw: z.boolean().optional().describe('Whether the channel is age-restricted'),
  parentId: z.string().optional().describe('The ID of the parent category'),
  bitrate: z.number().optional().describe('The bitrate of the voice channel'),
  userLimit: z.number().optional().describe('The user limit of the voice channel'),
  rateLimitPerUser: z.number().optional().describe('The rate limit per user'),
  rtcRegion: z.string().optional().describe('The voice region ID'),
  videoQualityMode: z.number().optional().describe('The video quality mode'),
  defaultAutoArchiveDuration: z.number().optional().describe('The default auto-archive duration'),
});

export function createChannelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_create_channel',
    description: 'Create a channel in Discord',
    inputSchema: createChannelInputSchema,
    outputSchema: createChannelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createChannelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<z.infer<typeof MetadataSchema>>();

      if (!metadata.botToken) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in metadata. Please provide a Discord bot token.',
        });
      }

      if (!input.guildId) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'guildId is required to create a channel.',
        });
      }

      const requestBody: Record<string, unknown> = {
        name: input.name,
      };

      if (input.type !== undefined) {
        requestBody['type'] = input.type;
      }
      if (input.topic !== undefined) {
        requestBody['topic'] = input.topic;
      }
      if (input.bitrate !== undefined) {
        requestBody['bitrate'] = input.bitrate;
      }
      if (input.userLimit !== undefined) {
        requestBody['user_limit'] = input.userLimit;
      }
      if (input.rateLimitPerUser !== undefined) {
        requestBody['rate_limit_per_user'] = input.rateLimitPerUser;
      }
      if (input.position !== undefined) {
        requestBody['position'] = input.position;
      }
      if (input.permissionOverwrites !== undefined) {
        requestBody['permission_overwrites'] = input.permissionOverwrites;
      }
      if (input.parentId !== undefined) {
        requestBody['parent_id'] = input.parentId;
      }
      if (input.nsfw !== undefined) {
        requestBody['nsfw'] = input.nsfw;
      }
      if (input.rtcRegion !== undefined) {
        requestBody['rtc_region'] = input.rtcRegion;
      }
      if (input.videoQualityMode !== undefined) {
        requestBody['video_quality_mode'] = input.videoQualityMode;
      }
      if (input.defaultAutoArchiveDuration !== undefined) {
        requestBody['default_auto_archive_duration'] = input.defaultAutoArchiveDuration;
      }
      if (input.defaultReactionEmoji !== undefined) {
        requestBody['default_reaction_emoji'] = input.defaultReactionEmoji;
      }
      if (input.availableTags !== undefined) {
        requestBody['available_tags'] = input.availableTags;
      }
      if (input.defaultSortOrder !== undefined) {
        requestBody['default_sort_order'] = input.defaultSortOrder;
      }
      if (input.defaultForumLayout !== undefined) {
        requestBody['default_forum_layout'] = input.defaultForumLayout;
      }
      if (input.defaultThreadRateLimitPerUser !== undefined) {
        requestBody['default_thread_rate_limit_per_user'] = input.defaultThreadRateLimitPerUser;
      }

      // https://discord.com/developers/docs/resources/guild#create-guild-channel
      const response = await platformProxy.post({
        endpoint: `/api/v10/guilds/${input.guildId}/channels`,
        data: requestBody,
        headers: {
          Authorization: `Bot ${metadata.botToken}`,
        },
        retries: 3,
      });

      const providerChannel = ProviderChannelSchema.parse(response.data);

      return {
        id: providerChannel.id,
        ...(providerChannel.guild_id !== undefined && { guildId: providerChannel.guild_id }),
        ...(providerChannel.name !== undefined && { name: providerChannel.name }),
        type: providerChannel.type,
        ...(providerChannel.position !== undefined && { position: providerChannel.position }),
        ...(providerChannel.topic !== null && providerChannel.topic !== undefined && { topic: providerChannel.topic }),
        ...(providerChannel.nsfw !== undefined && { nsfw: providerChannel.nsfw }),
        ...(providerChannel.parent_id !== null &&
          providerChannel.parent_id !== undefined && { parentId: providerChannel.parent_id }),
        ...(providerChannel.bitrate !== undefined && { bitrate: providerChannel.bitrate }),
        ...(providerChannel.user_limit !== undefined && { userLimit: providerChannel.user_limit }),
        ...(providerChannel.rate_limit_per_user !== undefined && {
          rateLimitPerUser: providerChannel.rate_limit_per_user,
        }),
        ...(providerChannel.rtc_region !== null &&
          providerChannel.rtc_region !== undefined && { rtcRegion: providerChannel.rtc_region }),
        ...(providerChannel.video_quality_mode !== undefined && {
          videoQualityMode: providerChannel.video_quality_mode,
        }),
        ...(providerChannel.default_auto_archive_duration !== undefined && {
          defaultAutoArchiveDuration: providerChannel.default_auto_archive_duration,
        }),
      };
    },
  });
}
