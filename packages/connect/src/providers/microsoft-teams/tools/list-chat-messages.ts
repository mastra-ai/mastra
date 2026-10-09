// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listChatMessagesInputSchema = z.object({
  chatId: z
    .string()
    .describe('The unique identifier of the chat. Example: "19:2da4c29f6d7041eca70b638b43d45437@thread.v2"'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor (full @odata.nextLink URL) from the previous response. Omit for the first page.'),
  top: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .describe('Maximum number of messages to return per page (1-50). Default is determined by the API.'),
});

const FromUserSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  userIdentityType: z.string().optional(),
});

const FromSchema = z.object({
  user: FromUserSchema.optional().nullable(),
});

const BodySchema = z.object({
  contentType: z.string().optional(),
  content: z.string().optional(),
});

const ChatMessageSchema = z.object({
  id: z.string(),
  replyToId: z.string().nullable().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  deletedDateTime: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  chatId: z.string().optional(),
  importance: z.string().optional(),
  messageType: z.string().optional(),
  from: FromSchema.nullable().optional(),
  body: BodySchema.nullable().optional(),
});

const OutputMessageSchema = z.object({
  id: z.string(),
  replyToId: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  deletedDateTime: z.string().optional(),
  subject: z.string().optional(),
  summary: z.string().optional(),
  chatId: z.string().optional(),
  importance: z.string().optional(),
  messageType: z.string().optional(),
  fromUserId: z.string().optional(),
  fromUserDisplayName: z.string().optional(),
  bodyContentType: z.string().optional(),
  bodyContent: z.string().optional(),
});

export const listChatMessagesOutputSchema = z.object({
  messages: z.array(OutputMessageSchema),
  nextLink: z
    .string()
    .optional()
    .describe('Full URL for the next page. Pass this value as the cursor input for the next request.'),
});

export function listChatMessagesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_teams_list_chat_messages',
    description: 'List messages in a chat.',
    inputSchema: listChatMessagesInputSchema,
    outputSchema: listChatMessagesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listChatMessagesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const url = input.cursor;

      let response;
      if (url) {
        // https://learn.microsoft.com/graph/api/chat-list-messages
        response = await platformProxy.get({
          endpoint: url,
          retries: 3,
        });
      } else {
        const params: Record<string, string | number> = {};
        if (input.top !== undefined) {
          params['$top'] = input.top;
        }

        // https://learn.microsoft.com/graph/api/chat-list-messages
        response = await platformProxy.get({
          endpoint: `/v1.0/chats/${encodeURIComponent(input.chatId)}/messages`,
          params,
          retries: 3,
        });
      }

      const ProviderResponseSchema = z.object({
        value: z.array(ChatMessageSchema),
        '@odata.nextLink': z.string().optional(),
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      const rawNextLink = providerData['@odata.nextLink'];

      const messages = providerData.value.map(message => {
        return {
          id: message.id,
          ...(message.replyToId !== null && message.replyToId !== undefined && { replyToId: message.replyToId }),
          ...(message.createdDateTime !== undefined && { createdDateTime: message.createdDateTime }),
          ...(message.lastModifiedDateTime !== undefined && { lastModifiedDateTime: message.lastModifiedDateTime }),
          ...(message.deletedDateTime !== null &&
            message.deletedDateTime !== undefined && { deletedDateTime: message.deletedDateTime }),
          ...(message.subject !== null && message.subject !== undefined && { subject: message.subject }),
          ...(message.summary !== null && message.summary !== undefined && { summary: message.summary }),
          ...(message.chatId !== undefined && { chatId: message.chatId }),
          ...(message.importance !== undefined && { importance: message.importance }),
          ...(message.messageType !== undefined && { messageType: message.messageType }),
          ...(message.from?.user?.id !== undefined && { fromUserId: message.from.user.id }),
          ...(message.from?.user?.displayName !== undefined && { fromUserDisplayName: message.from.user.displayName }),
          ...(message.body?.contentType !== undefined && { bodyContentType: message.body.contentType }),
          ...(message.body?.content !== undefined && { bodyContent: message.body.content }),
        };
      });

      return {
        messages,
        ...(typeof rawNextLink === 'string' && { nextLink: rawNextLink }),
      };
    },
  });
}
