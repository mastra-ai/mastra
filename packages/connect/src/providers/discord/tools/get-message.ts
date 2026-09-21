// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getMessageInputSchema = z.object({
  channelId: z.string().describe('The ID of the channel containing the message. Example: "1504364254634180618"'),
  messageId: z.string().describe('The ID of the message to retrieve. Example: "1234567890123456789"'),
});

const ProviderMessageSchema = z.object({
  id: z.string(),
  channel_id: z.string(),
  author: z.object({
    id: z.string(),
    username: z.string(),
    discriminator: z.string().optional(),
    global_name: z.string().nullable().optional(),
    avatar: z.string().nullable().optional(),
    bot: z.boolean().optional(),
    system: z.boolean().optional(),
  }),
  content: z.string(),
  timestamp: z.string(),
  edited_timestamp: z.string().nullable().optional(),
  tts: z.boolean().optional(),
  mention_everyone: z.boolean().optional(),
  mentions: z.array(z.unknown()).optional(),
  mention_roles: z.array(z.string()).optional(),
  attachments: z.array(z.unknown()).optional(),
  embeds: z.array(z.unknown()).optional(),
  reactions: z.array(z.unknown()).optional(),
  nonce: z.union([z.string(), z.number()]).optional(),
  pinned: z.boolean().optional(),
  webhook_id: z.string().optional(),
  type: z.number().optional(),
  activity: z.unknown().optional(),
  application: z.unknown().optional(),
  application_id: z.string().optional(),
  message_reference: z.unknown().optional(),
  flags: z.number().optional(),
  referenced_message: z.unknown().nullable().optional(),
  interaction: z.unknown().optional(),
  thread: z.unknown().optional(),
  components: z.array(z.unknown()).optional(),
  sticker_items: z.array(z.unknown()).optional(),
  stickers: z.array(z.unknown()).optional(),
  position: z.number().optional(),
  role_subscription_data: z.unknown().optional(),
  resolved: z.unknown().optional(),
});

export const getMessageOutputSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  author: z.object({
    id: z.string(),
    username: z.string(),
    discriminator: z.string().optional(),
    globalName: z.string().optional(),
    avatar: z.string().optional(),
    bot: z.boolean().optional(),
    system: z.boolean().optional(),
  }),
  content: z.string(),
  timestamp: z.string(),
  editedTimestamp: z.string().optional(),
  tts: z.boolean().optional(),
  mentionEveryone: z.boolean().optional(),
  mentions: z.array(z.unknown()).optional(),
  mentionRoles: z.array(z.string()).optional(),
  attachments: z.array(z.unknown()).optional(),
  embeds: z.array(z.unknown()).optional(),
  reactions: z.array(z.unknown()).optional(),
  nonce: z.union([z.string(), z.number()]).optional(),
  pinned: z.boolean().optional(),
  webhookId: z.string().optional(),
  type: z.number().optional(),
  activity: z.unknown().optional(),
  application: z.unknown().optional(),
  applicationId: z.string().optional(),
  messageReference: z.unknown().optional(),
  flags: z.number().optional(),
  referencedMessage: z.unknown().optional(),
  interaction: z.unknown().optional(),
  thread: z.unknown().optional(),
  components: z.array(z.unknown()).optional(),
  stickerItems: z.array(z.unknown()).optional(),
  stickers: z.array(z.unknown()).optional(),
  position: z.number().optional(),
  roleSubscriptionData: z.unknown().optional(),
  resolved: z.unknown().optional(),
});

export function getMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_get_message',
    description: 'Retrieve a single message from Discord.',
    inputSchema: getMessageInputSchema,
    outputSchema: getMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ botToken: string }>();

      if (!metadata?.botToken) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in metadata.',
        });
      }

      // https://discord.com/developers/docs/resources/message#get-channel-message
      const response = await platformProxy.get({
        endpoint: `/api/v10/channels/${input.channelId}/messages/${input.messageId}`,
        headers: {
          Authorization: `Bot ${metadata.botToken}`,
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Message not found',
          channelId: input.channelId,
          messageId: input.messageId,
        });
      }

      const providerMessage = ProviderMessageSchema.parse(response.data);

      return {
        id: providerMessage.id,
        channelId: providerMessage.channel_id,
        author: {
          id: providerMessage.author.id,
          username: providerMessage.author.username,
          ...(providerMessage.author.discriminator !== undefined && {
            discriminator: providerMessage.author.discriminator,
          }),
          ...(providerMessage.author.global_name != null && { globalName: providerMessage.author.global_name }),
          ...(providerMessage.author.avatar != null && { avatar: providerMessage.author.avatar }),
          ...(providerMessage.author.bot !== undefined && { bot: providerMessage.author.bot }),
          ...(providerMessage.author.system !== undefined && { system: providerMessage.author.system }),
        },
        content: providerMessage.content,
        timestamp: providerMessage.timestamp,
        ...(providerMessage.edited_timestamp != null && { editedTimestamp: providerMessage.edited_timestamp }),
        ...(providerMessage.tts !== undefined && { tts: providerMessage.tts }),
        ...(providerMessage.mention_everyone !== undefined && { mentionEveryone: providerMessage.mention_everyone }),
        ...(providerMessage.mentions !== undefined && { mentions: providerMessage.mentions }),
        ...(providerMessage.mention_roles !== undefined && { mentionRoles: providerMessage.mention_roles }),
        ...(providerMessage.attachments !== undefined && { attachments: providerMessage.attachments }),
        ...(providerMessage.embeds !== undefined && { embeds: providerMessage.embeds }),
        ...(providerMessage.reactions !== undefined && { reactions: providerMessage.reactions }),
        ...(providerMessage.nonce !== undefined && { nonce: providerMessage.nonce }),
        ...(providerMessage.pinned !== undefined && { pinned: providerMessage.pinned }),
        ...(providerMessage.webhook_id !== undefined && { webhookId: providerMessage.webhook_id }),
        ...(providerMessage.type !== undefined && { type: providerMessage.type }),
        ...(providerMessage.activity !== undefined && { activity: providerMessage.activity }),
        ...(providerMessage.application !== undefined && { application: providerMessage.application }),
        ...(providerMessage.application_id !== undefined && { applicationId: providerMessage.application_id }),
        ...(providerMessage.message_reference !== undefined && { messageReference: providerMessage.message_reference }),
        ...(providerMessage.flags !== undefined && { flags: providerMessage.flags }),
        ...(providerMessage.referenced_message != null && { referencedMessage: providerMessage.referenced_message }),
        ...(providerMessage.interaction !== undefined && { interaction: providerMessage.interaction }),
        ...(providerMessage.thread !== undefined && { thread: providerMessage.thread }),
        ...(providerMessage.components !== undefined && { components: providerMessage.components }),
        ...(providerMessage.sticker_items !== undefined && { stickerItems: providerMessage.sticker_items }),
        ...(providerMessage.stickers !== undefined && { stickers: providerMessage.stickers }),
        ...(providerMessage.position !== undefined && { position: providerMessage.position }),
        ...(providerMessage.role_subscription_data !== undefined && {
          roleSubscriptionData: providerMessage.role_subscription_data,
        }),
        ...(providerMessage.resolved !== undefined && { resolved: providerMessage.resolved }),
      };
    },
  });
}
