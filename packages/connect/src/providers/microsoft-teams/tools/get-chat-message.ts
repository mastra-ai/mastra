// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getChatMessageInputSchema = z.object({
  chatId: z
    .string()
    .describe('The ID of the chat containing the message. Example: "19:xxxxxxxxxxxxxxxxxxxxxxxxxxxx@thread.v2"'),
  messageId: z.string().describe('The ID of the chat message to retrieve. Example: "1659458708524"'),
});

const ProviderChatMessageSchema = z.object({
  id: z.string(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  deletedDateTime: z.string().nullable().optional(),
  from: z
    .object({
      user: z
        .object({
          id: z.string().optional(),
          displayName: z.string().nullable().optional(),
          email: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
      application: z
        .object({
          id: z.string().optional(),
          displayName: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  body: z
    .object({
      contentType: z.enum(['text', 'html']).or(z.string()).optional(),
      content: z.string().optional(),
    })
    .optional(),
  importance: z.enum(['normal', 'high', 'urgent']).or(z.string()).optional(),
  replyToId: z.string().nullable().optional(),
  messageType: z
    .enum(['message', 'chatEvent', 'systemEventMessage', 'typing', 'unknownFutureValue'])
    .or(z.string())
    .optional(),
});

export const getChatMessageOutputSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  deletedDateTime: z.string().optional(),
  from: z
    .object({
      user: z
        .object({
          id: z.string().optional(),
          displayName: z.string().optional(),
          email: z.string().optional(),
        })
        .optional(),
      application: z
        .object({
          id: z.string().optional(),
          displayName: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  body: z
    .object({
      contentType: z.enum(['text', 'html']).or(z.string()).optional(),
      content: z.string().optional(),
    })
    .optional(),
  importance: z.enum(['normal', 'high', 'urgent']).or(z.string()).optional(),
  replyToId: z.string().optional(),
  messageType: z
    .enum(['message', 'chatEvent', 'systemEventMessage', 'typing', 'unknownFutureValue'])
    .or(z.string())
    .optional(),
});

export function getChatMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_teams_get_chat_message',
    description: 'Retrieve a chat message by ID.',
    inputSchema: getChatMessageInputSchema,
    outputSchema: getChatMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getChatMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/chatmessage-get
      const response = await platformProxy.get({
        endpoint: `/v1.0/chats/${input.chatId}/messages/${input.messageId}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Chat message not found',
          chatId: input.chatId,
          messageId: input.messageId,
        });
      }

      const providerMessage = ProviderChatMessageSchema.parse(response.data);

      return {
        id: providerMessage.id,
        chatId: input.chatId,
        ...(providerMessage.createdDateTime !== undefined && { createdDateTime: providerMessage.createdDateTime }),
        ...(providerMessage.lastModifiedDateTime !== undefined && {
          lastModifiedDateTime: providerMessage.lastModifiedDateTime,
        }),
        ...(providerMessage.deletedDateTime !== undefined &&
          providerMessage.deletedDateTime !== null && { deletedDateTime: providerMessage.deletedDateTime }),
        ...(providerMessage.from !== undefined &&
          providerMessage.from !== null && {
            from: {
              ...(providerMessage.from.user !== undefined &&
                providerMessage.from.user !== null && {
                  user: {
                    ...(providerMessage.from.user.id !== undefined && { id: providerMessage.from.user.id }),
                    ...(providerMessage.from.user.displayName !== undefined &&
                      providerMessage.from.user.displayName !== null && {
                        displayName: providerMessage.from.user.displayName,
                      }),
                    ...(providerMessage.from.user.email !== undefined &&
                      providerMessage.from.user.email !== null && { email: providerMessage.from.user.email }),
                  },
                }),
              ...(providerMessage.from.application !== undefined &&
                providerMessage.from.application !== null && {
                  application: {
                    ...(providerMessage.from.application.id !== undefined && {
                      id: providerMessage.from.application.id,
                    }),
                    ...(providerMessage.from.application.displayName !== undefined &&
                      providerMessage.from.application.displayName !== null && {
                        displayName: providerMessage.from.application.displayName,
                      }),
                  },
                }),
            },
          }),
        ...(providerMessage.body !== undefined && {
          body: {
            ...(providerMessage.body.contentType !== undefined && { contentType: providerMessage.body.contentType }),
            ...(providerMessage.body.content !== undefined && { content: providerMessage.body.content }),
          },
        }),
        ...(providerMessage.importance !== undefined && { importance: providerMessage.importance }),
        ...(providerMessage.replyToId !== undefined &&
          providerMessage.replyToId !== null && { replyToId: providerMessage.replyToId }),
        ...(providerMessage.messageType !== undefined && { messageType: providerMessage.messageType }),
      };
    },
  });
}
