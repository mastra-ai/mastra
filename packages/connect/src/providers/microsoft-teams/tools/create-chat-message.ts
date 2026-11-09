// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const ContentTypeSchema = z.enum(['text', 'html']).describe('Content type of the message body. Example: "html"');

const ItemBodyInputSchema = z.object({
  contentType: ContentTypeSchema.optional().describe('Content type of the message body'),
  content: z
    .string()
    .describe('Content of the message body in plain text or HTML format. Example: "<p>Hello world</p>"'),
});

export const createChatMessageInputSchema = z.object({
  chatId: z
    .string()
    .describe('The unique identifier of the chat. Example: "19:2da4c29f6d7041eca70b638b43d45437@thread.v2"'),
  body: ItemBodyInputSchema.describe('The body of the chat message'),
});

const ChatMessageFromIdentitySchema = z
  .object({
    id: z.string(),
    displayName: z.string(),
    userIdentityType: z.string().optional(),
  })
  .passthrough();

const ChatMessageFromSchema = z
  .object({
    user: ChatMessageFromIdentitySchema.nullable().optional(),
  })
  .passthrough();

const ItemBodySchema = z
  .object({
    contentType: z.string(),
    content: z.string(),
  })
  .passthrough();

const ProviderChatMessageSchema = z
  .object({
    id: z.string(),
    chatId: z.string().nullable().optional(),
    body: ItemBodySchema.nullable().optional(),
    createdDateTime: z.string().nullable().optional(),
    lastModifiedDateTime: z.string().nullable().optional(),
    from: ChatMessageFromSchema.nullable().optional(),
    importance: z.string().nullable().optional(),
    messageType: z.string().nullable().optional(),
    webUrl: z.string().nullable().optional(),
  })
  .passthrough();

export const createChatMessageOutputSchema = z.object({
  id: z.string(),
  chatId: z.string().optional(),
  body: z
    .object({
      contentType: z.string(),
      content: z.string(),
    })
    .optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  from: z
    .object({
      id: z.string().optional(),
      displayName: z.string().optional(),
    })
    .optional(),
  importance: z.string().optional(),
  messageType: z.string().optional(),
  webUrl: z.string().optional(),
});

export function createChatMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_teams_create_chat_message',
    description: 'Send a message in a chat',
    inputSchema: createChatMessageInputSchema,
    outputSchema: createChatMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createChatMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const contentType = input.body.contentType ?? 'html';

      // https://learn.microsoft.com/en-us/graph/api/chat-post-messages
      const response = await platformProxy.post({
        endpoint: `/v1.0/chats/${input.chatId}/messages`,
        data: {
          body: {
            contentType: contentType,
            content: input.body.content,
          },
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'no_response',
          message: 'No response received from the API',
        });
      }

      const providerMessage = ProviderChatMessageSchema.parse(response.data);

      return {
        id: providerMessage.id,
        ...(providerMessage.chatId !== undefined &&
          providerMessage.chatId !== null && { chatId: providerMessage.chatId }),
        ...(providerMessage.body !== undefined &&
          providerMessage.body !== null && {
            body: {
              contentType: providerMessage.body.contentType,
              content: providerMessage.body.content,
            },
          }),
        ...(providerMessage.createdDateTime !== undefined &&
          providerMessage.createdDateTime !== null && { createdDateTime: providerMessage.createdDateTime }),
        ...(providerMessage.lastModifiedDateTime !== undefined &&
          providerMessage.lastModifiedDateTime !== null && {
            lastModifiedDateTime: providerMessage.lastModifiedDateTime,
          }),
        ...(providerMessage.from !== undefined &&
          providerMessage.from !== null &&
          providerMessage.from.user !== undefined &&
          providerMessage.from.user !== null && {
            from: {
              id: providerMessage.from.user.id,
              displayName: providerMessage.from.user.displayName,
            },
          }),
        ...(providerMessage.importance !== undefined &&
          providerMessage.importance !== null && { importance: providerMessage.importance }),
        ...(providerMessage.messageType !== undefined &&
          providerMessage.messageType !== null && { messageType: providerMessage.messageType }),
        ...(providerMessage.webUrl !== undefined &&
          providerMessage.webUrl !== null && { webUrl: providerMessage.webUrl }),
      };
    },
  });
}
