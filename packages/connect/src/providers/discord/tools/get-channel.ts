// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getChannelInputSchema = z.object({
  channelId: z.string().describe('The ID of the channel to retrieve. Example: "41771983423143937"'),
});

const ProviderChannelSchema = z
  .object({
    id: z.string(),
    type: z.number(),
    guild_id: z.string().optional(),
    position: z.number().optional(),
    permission_overwrites: z.array(z.unknown()).optional(),
    name: z.string().nullable().optional(),
    topic: z.string().nullable().optional(),
    nsfw: z.boolean().optional(),
    last_message_id: z.string().nullable().optional(),
    bitrate: z.number().optional(),
    user_limit: z.number().optional(),
    rate_limit_per_user: z.number().optional(),
    recipients: z.array(z.unknown()).optional(),
    icon: z.string().nullable().optional(),
    owner_id: z.string().optional(),
    application_id: z.string().optional(),
    managed: z.boolean().optional(),
    parent_id: z.string().nullable().optional(),
    last_pin_timestamp: z.string().nullable().optional(),
    rtc_region: z.string().nullable().optional(),
    video_quality_mode: z.number().optional(),
    message_count: z.number().optional(),
    member_count: z.number().optional(),
    thread_metadata: z.unknown().optional(),
    member: z.unknown().optional(),
    default_auto_archive_duration: z.number().optional(),
    permissions: z.string().optional(),
    flags: z.number().optional(),
    total_message_sent: z.number().optional(),
    available_tags: z.array(z.unknown()).optional(),
    applied_tags: z.array(z.string()).optional(),
    default_reaction_emoji: z.unknown().nullable().optional(),
    default_thread_rate_limit_per_user: z.number().optional(),
    default_sort_order: z.number().nullable().optional(),
    default_forum_layout: z.number().optional(),
  })
  .passthrough();

export const getChannelOutputSchema = z.object({
  id: z.string(),
  type: z.number(),
  guildId: z.string().optional(),
  position: z.number().optional(),
  permissionOverwrites: z.array(z.unknown()).optional(),
  name: z.string().optional(),
  topic: z.string().optional(),
  nsfw: z.boolean().optional(),
  lastMessageId: z.string().optional(),
  bitrate: z.number().optional(),
  userLimit: z.number().optional(),
  rateLimitPerUser: z.number().optional(),
  recipients: z.array(z.unknown()).optional(),
  icon: z.string().optional(),
  ownerId: z.string().optional(),
  applicationId: z.string().optional(),
  managed: z.boolean().optional(),
  parentId: z.string().optional(),
  lastPinTimestamp: z.string().optional(),
  rtcRegion: z.string().optional(),
  videoQualityMode: z.number().optional(),
  messageCount: z.number().optional(),
  memberCount: z.number().optional(),
  threadMetadata: z.unknown().optional(),
  member: z.unknown().optional(),
  defaultAutoArchiveDuration: z.number().optional(),
  permissions: z.string().optional(),
  flags: z.number().optional(),
  totalMessageSent: z.number().optional(),
  availableTags: z.array(z.unknown()).optional(),
  appliedTags: z.array(z.string()).optional(),
  defaultReactionEmoji: z.unknown().optional(),
  defaultThreadRateLimitPerUser: z.number().optional(),
  defaultSortOrder: z.number().optional(),
  defaultForumLayout: z.number().optional(),
});

export function getChannelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_get_channel',
    description: 'Retrieve a single channel from Discord',
    inputSchema: getChannelInputSchema,
    outputSchema: getChannelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getChannelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ botToken: string }>();

      if (!metadata?.botToken) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in metadata. Please set up the connection with botToken in metadata.',
        });
      }

      // https://discord.com/developers/docs/resources/channel#get-channel
      const response = await platformProxy.get({
        endpoint: `/api/v10/channels/${input.channelId}`,
        headers: {
          Authorization: `Bot ${metadata.botToken}`,
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Channel not found: ${input.channelId}`,
        });
      }

      const channel = ProviderChannelSchema.parse(response.data);

      return {
        id: channel.id,
        type: channel.type,
        ...(channel.guild_id !== undefined && { guildId: channel.guild_id }),
        ...(channel.position !== undefined && { position: channel.position }),
        ...(channel.permission_overwrites !== undefined && { permissionOverwrites: channel.permission_overwrites }),
        ...(channel.name !== undefined && channel.name !== null && { name: channel.name }),
        ...(channel.topic !== undefined && channel.topic !== null && { topic: channel.topic }),
        ...(channel.nsfw !== undefined && { nsfw: channel.nsfw }),
        ...(channel.last_message_id !== undefined &&
          channel.last_message_id !== null && { lastMessageId: channel.last_message_id }),
        ...(channel.bitrate !== undefined && { bitrate: channel.bitrate }),
        ...(channel.user_limit !== undefined && { userLimit: channel.user_limit }),
        ...(channel.rate_limit_per_user !== undefined && { rateLimitPerUser: channel.rate_limit_per_user }),
        ...(channel.recipients !== undefined && { recipients: channel.recipients }),
        ...(channel.icon !== undefined && channel.icon !== null && { icon: channel.icon }),
        ...(channel.owner_id !== undefined && { ownerId: channel.owner_id }),
        ...(channel.application_id !== undefined && { applicationId: channel.application_id }),
        ...(channel.managed !== undefined && { managed: channel.managed }),
        ...(channel.parent_id !== undefined && channel.parent_id !== null && { parentId: channel.parent_id }),
        ...(channel.last_pin_timestamp !== undefined &&
          channel.last_pin_timestamp !== null && { lastPinTimestamp: channel.last_pin_timestamp }),
        ...(channel.rtc_region !== undefined && channel.rtc_region !== null && { rtcRegion: channel.rtc_region }),
        ...(channel.video_quality_mode !== undefined && { videoQualityMode: channel.video_quality_mode }),
        ...(channel.message_count !== undefined && { messageCount: channel.message_count }),
        ...(channel.member_count !== undefined && { memberCount: channel.member_count }),
        ...(channel.thread_metadata !== undefined && { threadMetadata: channel.thread_metadata }),
        ...(channel.member !== undefined && { member: channel.member }),
        ...(channel.default_auto_archive_duration !== undefined && {
          defaultAutoArchiveDuration: channel.default_auto_archive_duration,
        }),
        ...(channel.permissions !== undefined && { permissions: channel.permissions }),
        ...(channel.flags !== undefined && { flags: channel.flags }),
        ...(channel.total_message_sent !== undefined && { totalMessageSent: channel.total_message_sent }),
        ...(channel.available_tags !== undefined && { availableTags: channel.available_tags }),
        ...(channel.applied_tags !== undefined && { appliedTags: channel.applied_tags }),
        ...(channel.default_reaction_emoji !== undefined &&
          channel.default_reaction_emoji !== null && { defaultReactionEmoji: channel.default_reaction_emoji }),
        ...(channel.default_thread_rate_limit_per_user !== undefined && {
          defaultThreadRateLimitPerUser: channel.default_thread_rate_limit_per_user,
        }),
        ...(channel.default_sort_order !== undefined &&
          channel.default_sort_order !== null && { defaultSortOrder: channel.default_sort_order }),
        ...(channel.default_forum_layout !== undefined && { defaultForumLayout: channel.default_forum_layout }),
      };
    },
  });
}
