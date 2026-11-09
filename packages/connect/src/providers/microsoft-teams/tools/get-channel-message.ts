// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getChannelMessageInputSchema = z.object({
  teamId: z.string().describe('The unique identifier of the team. Example: "fbe2bf47-16c8-47cf-b4a5-4b9b187c508b"'),
  channelId: z
    .string()
    .describe('The unique identifier of the channel. Example: "19:4a95f7d8db4c4e7fae857bcebe0623e6@thread.tacv2"'),
  messageId: z.string().describe('The unique identifier of the message. Example: "1614618259349"'),
});

const TeamworkUserIdentitySchema = z.object({
  id: z.string().optional(),
  displayName: z.string().nullable().optional(),
  userIdentityType: z.string().optional(),
  tenantId: z.string().optional(),
});

const ChatMessageFromIdentitySetSchema = z.object({
  application: z.unknown().nullable().optional(),
  device: z.unknown().nullable().optional(),
  conversation: z.unknown().nullable().optional(),
  user: TeamworkUserIdentitySchema.nullable().optional(),
});

const ItemBodySchema = z.object({
  contentType: z.string().optional(),
  content: z.string().nullable().optional(),
});

const ChannelIdentitySchema = z.object({
  teamId: z.string().optional(),
  channelId: z.string().optional(),
});

const ProviderChatMessageSchema = z.object({
  id: z.string(),
  replyToId: z.string().nullable().optional(),
  etag: z.string().optional(),
  messageType: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  lastEditedDateTime: z.string().nullable().optional(),
  deletedDateTime: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  chatId: z.string().nullable().optional(),
  importance: z.string().optional(),
  locale: z.string().optional(),
  webUrl: z.string().nullable().optional(),
  channelIdentity: ChannelIdentitySchema.nullable().optional(),
  from: ChatMessageFromIdentitySetSchema.nullable().optional(),
  body: ItemBodySchema.nullable().optional(),
});

export const getChannelMessageOutputSchema = z.object({
  id: z.string(),
  replyToId: z.string().optional(),
  messageType: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  lastEditedDateTime: z.string().optional(),
  deletedDateTime: z.string().optional(),
  subject: z.string().optional(),
  summary: z.string().optional(),
  importance: z.string().optional(),
  locale: z.string().optional(),
  webUrl: z.string().optional(),
  channelIdentity: z
    .object({
      teamId: z.string().optional(),
      channelId: z.string().optional(),
    })
    .optional(),
  from: z
    .object({
      user: z
        .object({
          id: z.string().optional(),
          displayName: z.string().optional(),
          userIdentityType: z.string().optional(),
          tenantId: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  body: z
    .object({
      contentType: z.string().optional(),
      content: z.string().optional(),
    })
    .optional(),
});

export function getChannelMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_teams_get_channel_message',
    description: 'Retrieve a channel message by ID.',
    inputSchema: getChannelMessageInputSchema,
    outputSchema: getChannelMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getChannelMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/chatmessage-get
      const response = await platformProxy.get({
        endpoint: `/v1.0/teams/${input.teamId}/channels/${input.channelId}/messages/${input.messageId}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Channel message not found',
          teamId: input.teamId,
          channelId: input.channelId,
          messageId: input.messageId,
        });
      }

      const providerMessage = ProviderChatMessageSchema.parse(response.data);

      return {
        id: providerMessage.id,
        ...(providerMessage.replyToId != null && { replyToId: providerMessage.replyToId }),
        ...(providerMessage.messageType !== undefined && { messageType: providerMessage.messageType }),
        ...(providerMessage.createdDateTime !== undefined && { createdDateTime: providerMessage.createdDateTime }),
        ...(providerMessage.lastModifiedDateTime !== undefined && {
          lastModifiedDateTime: providerMessage.lastModifiedDateTime,
        }),
        ...(providerMessage.lastEditedDateTime != null && { lastEditedDateTime: providerMessage.lastEditedDateTime }),
        ...(providerMessage.deletedDateTime != null && { deletedDateTime: providerMessage.deletedDateTime }),
        ...(providerMessage.subject != null && { subject: providerMessage.subject }),
        ...(providerMessage.summary != null && { summary: providerMessage.summary }),
        ...(providerMessage.importance !== undefined && { importance: providerMessage.importance }),
        ...(providerMessage.locale !== undefined && { locale: providerMessage.locale }),
        ...(providerMessage.webUrl != null && { webUrl: providerMessage.webUrl }),
        ...(providerMessage.channelIdentity != null && {
          channelIdentity: {
            ...(providerMessage.channelIdentity.teamId !== undefined && {
              teamId: providerMessage.channelIdentity.teamId,
            }),
            ...(providerMessage.channelIdentity.channelId !== undefined && {
              channelId: providerMessage.channelIdentity.channelId,
            }),
          },
        }),
        ...(providerMessage.from != null &&
          providerMessage.from.user != null && {
            from: {
              user: {
                ...(providerMessage.from.user.id !== undefined && { id: providerMessage.from.user.id }),
                ...(providerMessage.from.user.displayName != null && {
                  displayName: providerMessage.from.user.displayName,
                }),
                ...(providerMessage.from.user.userIdentityType !== undefined && {
                  userIdentityType: providerMessage.from.user.userIdentityType,
                }),
                ...(providerMessage.from.user.tenantId !== undefined && {
                  tenantId: providerMessage.from.user.tenantId,
                }),
              },
            },
          }),
        ...(providerMessage.body != null && {
          body: {
            ...(providerMessage.body.contentType !== undefined && { contentType: providerMessage.body.contentType }),
            ...(providerMessage.body.content != null && { content: providerMessage.body.content }),
          },
        }),
      };
    },
  });
}
