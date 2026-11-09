// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getChatInputSchema = z.object({
  id: z.string().describe('The ID of the chat. Example: "19:xxx@thread.v2"'),
});

const ProviderChatSchema = z.object({
  id: z.string(),
  topic: z.string().nullable().optional(),
  chatType: z.enum(['oneOnOne', 'group', 'meeting', 'unknownFutureValue']).or(z.string()).optional(),
  createdDateTime: z.string().optional(),
  lastUpdatedDateTime: z.string().optional(),
  onlineMeetingInfo: z
    .object({
      joinWebUrl: z.string().optional(),
    })
    .passthrough()
    .nullable()
    .optional(),
  tenantId: z.string().optional(),
  webUrl: z.string().nullable().optional(),
});

export const getChatOutputSchema = z.object({
  id: z.string(),
  topic: z.string().optional(),
  chat_type: z.enum(['oneOnOne', 'group', 'meeting', 'unknownFutureValue']).or(z.string()).optional(),
  created_at: z.string().optional(),
  last_updated_at: z.string().optional(),
  join_url: z.string().optional(),
  tenant_id: z.string().optional(),
  web_url: z.string().optional(),
});

export function getChatTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_teams_get_chat',
    description: 'Retrieve a chat by ID.',
    inputSchema: getChatInputSchema,
    outputSchema: getChatOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getChatOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://learn.microsoft.com/graph/api/chat-get
        endpoint: `/v1.0/chats/${input.id}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Chat not found',
          id: input.id,
        });
      }

      const providerChat = ProviderChatSchema.parse(response.data);

      return {
        id: providerChat.id,
        ...(providerChat.topic != null && { topic: providerChat.topic }),
        ...(providerChat.chatType !== undefined && { chat_type: providerChat.chatType }),
        ...(providerChat.createdDateTime !== undefined && { created_at: providerChat.createdDateTime }),
        ...(providerChat.lastUpdatedDateTime !== undefined && { last_updated_at: providerChat.lastUpdatedDateTime }),
        ...(providerChat.onlineMeetingInfo?.joinWebUrl !== undefined && {
          join_url: providerChat.onlineMeetingInfo.joinWebUrl,
        }),
        ...(providerChat.tenantId !== undefined && { tenant_id: providerChat.tenantId }),
        ...(providerChat.webUrl != null && { web_url: providerChat.webUrl }),
      };
    },
  });
}
