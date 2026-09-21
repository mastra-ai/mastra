// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createMessageInputSchema = z
  .object({
    channelId: z.string().describe('The ID of the channel to send the message to. Example: "1504353981911273533"'),
    content: z
      .string()
      .optional()
      .describe(
        'The message content (max 2000 characters). One of content, embeds, components, sticker_ids, or files is required.',
      ),
    embeds: z.array(z.unknown()).optional().describe('Array of embed objects. Up to 10 embeds.'),
    components: z.array(z.unknown()).optional().describe('Array of message component objects.'),
    stickerIds: z.array(z.string()).optional().describe('Array of sticker IDs (max 3).'),
    allowedMentions: z
      .object({
        parse: z.array(z.enum(['roles', 'users', 'everyone'])).optional(),
        roles: z.array(z.string()).optional(),
        users: z.array(z.string()).optional(),
        replied_user: z.boolean().optional(),
      })
      .optional()
      .describe('Allowed mentions configuration.'),
    messageReference: z
      .object({
        message_id: z.string(),
        channel_id: z.string().optional(),
        guild_id: z.string().optional(),
        fail_if_not_exists: z.boolean().optional(),
      })
      .optional()
      .describe('Reference to a message to reply to.'),
  })
  .refine(
    data =>
      data.content !== undefined ||
      (data.embeds && data.embeds.length > 0) ||
      (data.components && data.components.length > 0) ||
      (data.stickerIds && data.stickerIds.length > 0),
    {
      message: 'At least one of content, embeds, components, or stickerIds must be provided.',
    },
  );

const AuthorSchema = z.object({
  id: z.string(),
  username: z.string(),
  discriminator: z.string(),
  global_name: z.string().nullable().optional(),
  bot: z.boolean().optional(),
  system: z.boolean().optional(),
});

const ProviderMessageSchema = z.object({
  id: z.string(),
  channel_id: z.string(),
  guild_id: z.string().nullable().optional(),
  author: AuthorSchema,
  content: z.string(),
  timestamp: z.string(),
  edited_timestamp: z.string().nullable().optional(),
  tts: z.boolean().optional(),
  mention_everyone: z.boolean().optional(),
  mentions: z.array(AuthorSchema).optional(),
  mention_roles: z.array(z.string()).optional(),
  embeds: z.array(z.unknown()).optional(),
  components: z.array(z.unknown()).optional(),
  pinned: z.boolean().optional(),
  type: z.number().optional(),
});

export const createMessageOutputSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  guildId: z.string().optional(),
  authorId: z.string(),
  authorUsername: z.string(),
  content: z.string(),
  timestamp: z.string(),
  editedTimestamp: z.string().optional(),
  tts: z.boolean().optional(),
  pinned: z.boolean().optional(),
  type: z.number().optional(),
});

export function createMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_create_message',
    description: 'Create a message in Discord.',
    inputSchema: createMessageInputSchema,
    outputSchema: createMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ botToken: string }>();
      const botToken = metadata?.botToken;

      if (!botToken) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in connection metadata.',
        });
      }

      const requestBody: Record<string, unknown> = {};
      if (input.content !== undefined) {
        requestBody['content'] = input.content;
      }
      if (input.embeds !== undefined) {
        requestBody['embeds'] = input.embeds;
      }
      if (input.components !== undefined) {
        requestBody['components'] = input.components;
      }
      if (input.stickerIds !== undefined) {
        requestBody['sticker_ids'] = input.stickerIds;
      }
      if (input.allowedMentions !== undefined) {
        requestBody['allowed_mentions'] = input.allowedMentions;
      }
      if (input.messageReference !== undefined) {
        requestBody['message_reference'] = input.messageReference;
      }

      // https://discord.com/developers/docs/resources/channel#create-message
      const response = await platformProxy.post({
        endpoint: `/api/v10/channels/${input.channelId}/messages`,
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        data: requestBody,
        retries: 3,
      });

      const providerMessage = ProviderMessageSchema.parse(response.data);

      return {
        id: providerMessage.id,
        channelId: providerMessage.channel_id,
        ...(providerMessage.guild_id != null && { guildId: providerMessage.guild_id }),
        authorId: providerMessage.author.id,
        authorUsername: providerMessage.author.username,
        content: providerMessage.content,
        timestamp: providerMessage.timestamp,
        ...(providerMessage.edited_timestamp != null && { editedTimestamp: providerMessage.edited_timestamp }),
        ...(providerMessage.tts !== undefined && { tts: providerMessage.tts }),
        ...(providerMessage.pinned !== undefined && { pinned: providerMessage.pinned }),
        ...(providerMessage.type !== undefined && { type: providerMessage.type }),
      };
    },
  });
}
