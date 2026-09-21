// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateChannelInputSchema = z.object({
  channel_id: z.string().describe('The ID of the channel to update. Example: "1504364254634180618"'),
  name: z.string().min(1).max(100).optional().describe('The name of the channel (1-100 characters).'),
  type: z.number().int().optional().describe('The type of channel.'),
  position: z.number().int().optional().describe('The position of the channel in the left-hand listing.'),
  topic: z.string().max(1024).optional().nullable().describe('The channel topic (0-1024 characters).'),
  nsfw: z.boolean().optional().describe('Whether the channel is NSFW.'),
  rate_limit_per_user: z
    .number()
    .int()
    .min(0)
    .max(21600)
    .optional()
    .describe('Amount of seconds a user has to wait before sending another message (0-21600).'),
  bitrate: z.number().int().optional().describe('The bitrate (in bits) of the voice channel.'),
  user_limit: z.number().int().optional().describe('The user limit of the voice channel.'),
  permission_overwrites: z
    .array(
      z.object({
        id: z.string(),
        type: z.number().int(),
        allow: z.string(),
        deny: z.string(),
      }),
    )
    .optional()
    .describe('Channel or category-specific permissions.'),
  parent_id: z.string().optional().nullable().describe('ID of the parent category for a channel.'),
  default_auto_archive_duration: z
    .number()
    .int()
    .optional()
    .describe('Default duration that the clients use (not the API) for newly created threads in the channel.'),
  flags: z.number().int().optional().describe('Channel flags combined as a bitfield.'),
});

const ProviderChannelSchema = z.object({
  id: z.string(),
  type: z.number().int(),
  guild_id: z.string().optional(),
  name: z.string().optional().nullable(),
  position: z.number().int().optional(),
  permission_overwrites: z
    .array(
      z.object({
        id: z.string(),
        type: z.number().int(),
        allow: z.string(),
        deny: z.string(),
      }),
    )
    .optional(),
  nsfw: z.boolean().optional(),
  parent_id: z.string().optional().nullable(),
  topic: z.string().optional().nullable(),
  last_message_id: z.string().optional().nullable(),
  bitrate: z.number().int().optional(),
  user_limit: z.number().int().optional(),
  rate_limit_per_user: z.number().int().optional(),
  default_auto_archive_duration: z.number().int().optional(),
  flags: z.number().int().optional(),
});

const MetadataSchema = z.object({
  botToken: z.string(),
});

export const updateChannelOutputSchema = z.object({
  id: z.string(),
  type: z.number().int(),
  guild_id: z.string().optional(),
  name: z.string().optional(),
  position: z.number().int().optional(),
  permission_overwrites: z
    .array(
      z.object({
        id: z.string(),
        type: z.number().int(),
        allow: z.string(),
        deny: z.string(),
      }),
    )
    .optional(),
  nsfw: z.boolean().optional(),
  parent_id: z.string().optional(),
  topic: z.string().optional(),
  last_message_id: z.string().optional(),
  bitrate: z.number().int().optional(),
  user_limit: z.number().int().optional(),
  rate_limit_per_user: z.number().int().optional(),
  default_auto_archive_duration: z.number().int().optional(),
  flags: z.number().int().optional(),
});

export function updateChannelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_update_channel',
    description: 'Update a Discord channel.',
    inputSchema: updateChannelInputSchema,
    outputSchema: updateChannelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateChannelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const rawMetadata = await platformProxy.getMetadata();
      const metadata = MetadataSchema.safeParse(rawMetadata);

      if (!metadata.success || !metadata.data.botToken) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in metadata. Please set the Discord bot token in the connection metadata.',
        });
      }

      const updateData: Record<string, unknown> = {};

      if (input['name'] !== undefined) {
        updateData['name'] = input['name'];
      }
      if (input['type'] !== undefined) {
        updateData['type'] = input['type'];
      }
      if (input['position'] !== undefined) {
        updateData['position'] = input['position'];
      }
      if (input['topic'] !== undefined) {
        updateData['topic'] = input['topic'];
      }
      if (input['nsfw'] !== undefined) {
        updateData['nsfw'] = input['nsfw'];
      }
      if (input['rate_limit_per_user'] !== undefined) {
        updateData['rate_limit_per_user'] = input['rate_limit_per_user'];
      }
      if (input['bitrate'] !== undefined) {
        updateData['bitrate'] = input['bitrate'];
      }
      if (input['user_limit'] !== undefined) {
        updateData['user_limit'] = input['user_limit'];
      }
      if (input['permission_overwrites'] !== undefined) {
        updateData['permission_overwrites'] = input['permission_overwrites'];
      }
      if (input['parent_id'] !== undefined) {
        updateData['parent_id'] = input['parent_id'];
      }
      if (input['default_auto_archive_duration'] !== undefined) {
        updateData['default_auto_archive_duration'] = input['default_auto_archive_duration'];
      }
      if (input['flags'] !== undefined) {
        updateData['flags'] = input['flags'];
      }

      // https://discord.com/developers/docs/resources/channel#modify-channel
      const response = await platformProxy.patch({
        endpoint: `/api/v10/channels/${input.channel_id}`,
        headers: {
          Authorization: `Bot ${metadata.data.botToken}`,
        },
        data: updateData,
        retries: 10,
      });

      if (response.status === 404) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Channel not found',
          channel_id: input.channel_id,
        });
      }

      if (response.status === 403) {
        throw new platformProxy.ActionError({
          type: 'forbidden',
          message: 'Bot lacks permission to update this channel',
          channel_id: input.channel_id,
        });
      }

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'empty_response',
          message: 'Discord API returned an empty response',
        });
      }

      const providerChannel = ProviderChannelSchema.parse(response.data);

      return {
        id: providerChannel.id,
        type: providerChannel.type,
        ...(providerChannel.guild_id !== undefined && { guild_id: providerChannel.guild_id }),
        ...(providerChannel.name !== undefined && providerChannel.name !== null && { name: providerChannel.name }),
        ...(providerChannel.position !== undefined && { position: providerChannel.position }),
        ...(providerChannel.permission_overwrites !== undefined && {
          permission_overwrites: providerChannel.permission_overwrites,
        }),
        ...(providerChannel.nsfw !== undefined && { nsfw: providerChannel.nsfw }),
        ...(providerChannel.parent_id !== undefined &&
          providerChannel.parent_id !== null && { parent_id: providerChannel.parent_id }),
        ...(providerChannel.topic !== undefined && providerChannel.topic !== null && { topic: providerChannel.topic }),
        ...(providerChannel.last_message_id !== undefined &&
          providerChannel.last_message_id !== null && { last_message_id: providerChannel.last_message_id }),
        ...(providerChannel.bitrate !== undefined && { bitrate: providerChannel.bitrate }),
        ...(providerChannel.user_limit !== undefined && { user_limit: providerChannel.user_limit }),
        ...(providerChannel.rate_limit_per_user !== undefined && {
          rate_limit_per_user: providerChannel.rate_limit_per_user,
        }),
        ...(providerChannel.default_auto_archive_duration !== undefined && {
          default_auto_archive_duration: providerChannel.default_auto_archive_duration,
        }),
        ...(providerChannel.flags !== undefined && { flags: providerChannel.flags }),
      };
    },
  });
}
