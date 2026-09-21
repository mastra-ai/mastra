// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const SnowflakeSchema = z.string();

export const listMessagesInputSchema = z
  .object({
    channel_id: SnowflakeSchema.describe('The ID of the channel to list messages from. Example: "1504364254634180618"'),
    limit: z.number().int().min(1).max(100).optional().describe('Number of messages to return (1-100). Default: 50'),
    before: SnowflakeSchema.optional().describe('Return messages before this message ID'),
    after: SnowflakeSchema.optional().describe('Return messages after this message ID'),
    around: SnowflakeSchema.optional().describe(
      'Return messages around this message ID (ignores limit, returns 25 by default)',
    ),
  })
  .refine(data => [data.before, data.after, data.around].filter(Boolean).length <= 1, {
    message: 'Only one of before, after, or around can be provided.',
  });

const ProviderAuthorSchema = z.object({
  id: SnowflakeSchema.optional(),
  username: z.string(),
  discriminator: z.string(),
  global_name: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  bot: z.boolean().optional(),
  system: z.boolean().optional(),
});

const ProviderAttachmentSchema = z.object({
  id: SnowflakeSchema,
  filename: z.string(),
  content_type: z.string().optional(),
  size: z.number().int(),
  url: z.string(),
  proxy_url: z.string(),
  height: z.number().int().nullable().optional(),
  width: z.number().int().nullable().optional(),
});

const ProviderEmbedSchema = z.object({
  title: z.string().optional(),
  type: z.string().optional(),
  description: z.string().optional(),
  url: z.string().optional(),
});

const ProviderMessageSchema = z.object({
  id: SnowflakeSchema,
  channel_id: SnowflakeSchema,
  guild_id: SnowflakeSchema.optional(),
  author: ProviderAuthorSchema,
  content: z.string(),
  timestamp: z.string(),
  edited_timestamp: z.string().nullable(),
  tts: z.boolean(),
  mention_everyone: z.boolean(),
  mentions: z.array(ProviderAuthorSchema),
  mention_roles: z.array(SnowflakeSchema),
  attachments: z.array(ProviderAttachmentSchema),
  embeds: z.array(ProviderEmbedSchema),
  pinned: z.boolean(),
  type: z.number().int(),
});

const AuthorSchema = z.object({
  id: z.string().optional(),
  username: z.string(),
  global_name: z.string().optional(),
  avatar: z.string().optional(),
  bot: z.boolean().optional(),
});

const AttachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  content_type: z.string().optional(),
  size: z.number().int(),
  url: z.string(),
  height: z.number().int().optional(),
  width: z.number().int().optional(),
});

const MessageSchema = z.object({
  id: z.string(),
  channel_id: z.string(),
  guild_id: z.string().optional(),
  author: AuthorSchema,
  content: z.string(),
  timestamp: z.string(),
  edited_timestamp: z.string().optional(),
  tts: z.boolean(),
  mention_everyone: z.boolean(),
  pinned: z.boolean(),
  type: z.number().int(),
  attachments: z.array(AttachmentSchema),
  mention_count: z.number().int(),
});

export const listMessagesOutputSchema = z.object({
  messages: z.array(MessageSchema),
  has_more: z.boolean().describe('Whether more messages are available'),
});

export function listMessagesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_list_messages',
    description: 'List messages from a Discord channel with optional pagination filters',
    inputSchema: listMessagesInputSchema,
    outputSchema: listMessagesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listMessagesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ botToken: string }>();
      const botToken = metadata?.botToken;

      if (!botToken) {
        throw new platformProxy.ActionError({
          type: 'missing_bot_token',
          message:
            'Bot token is required in connection metadata. Please configure the bot token in your Nango connection.',
        });
      }

      const params: Record<string, string | number> = {};
      if (input.limit !== undefined) {
        params['limit'] = input.limit;
      }
      if (input.before !== undefined) {
        params['before'] = input.before;
      }
      if (input.after !== undefined) {
        params['after'] = input.after;
      }
      if (input.around !== undefined) {
        params['around'] = input.around;
      }

      // https://discord.com/developers/docs/resources/channel#get-channel-messages
      const response = await platformProxy.get({
        endpoint: `/api/v10/channels/${input.channel_id}/messages`,
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        params,
        retries: 3,
      });

      if (!response.data || !Array.isArray(response.data)) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Discord API',
          channel_id: input.channel_id,
        });
      }

      const messages = response.data.map((msg: unknown) => {
        const parsed = ProviderMessageSchema.parse(msg);
        return {
          id: parsed.id,
          channel_id: parsed.channel_id,
          ...(parsed.guild_id && { guild_id: parsed.guild_id }),
          author: {
            id: parsed.author.id,
            username: parsed.author.username,
            ...(parsed.author.global_name && { global_name: parsed.author.global_name }),
            ...(parsed.author.avatar && { avatar: parsed.author.avatar }),
            ...(parsed.author.bot && { bot: parsed.author.bot }),
          },
          content: parsed.content,
          timestamp: parsed.timestamp,
          ...(parsed.edited_timestamp && { edited_timestamp: parsed.edited_timestamp }),
          tts: parsed.tts,
          mention_everyone: parsed.mention_everyone,
          pinned: parsed.pinned,
          type: parsed.type,
          attachments: parsed.attachments.map(att => ({
            id: att.id,
            filename: att.filename,
            ...(att.content_type && { content_type: att.content_type }),
            size: att.size,
            url: att.url,
            ...(att.height !== null && att.height !== undefined && { height: att.height }),
            ...(att.width !== null && att.width !== undefined && { width: att.width }),
          })),
          mention_count: parsed.mentions.length,
        };
      });

      // Discord returns messages in reverse chronological order (newest first)
      // If we got a full page, there might be more messages
      const hasMore = messages.length === (input.limit || 50) && messages.length > 0;

      return {
        messages,
        has_more: hasMore,
      };
    },
  });
}
