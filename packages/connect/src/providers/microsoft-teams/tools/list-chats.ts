// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listChatsInputSchema = z.object({
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor from the previous response (@odata.nextLink). Omit for the first page.'),
  userId: z.string().optional().describe('User ID to scope chats to a specific user. Omit to use /me/chats.'),
});

const ViewpointSchema = z.object({
  isHidden: z.boolean().optional(),
  lastMessageReadDateTime: z.string().optional(),
});

const ChatSchema = z.object({
  id: z.string(),
  topic: z.string().nullable().optional(),
  createdDateTime: z.string().optional(),
  lastUpdatedDateTime: z.string().optional(),
  chatType: z.string().optional(),
  webUrl: z.string().nullable().optional(),
  isHiddenForAllMembers: z.boolean().optional(),
  tenantId: z.string().nullable().optional(),
  viewpoint: ViewpointSchema.optional(),
});

const ProviderResponseSchema = z.object({
  value: z.array(ChatSchema),
  '@odata.nextLink': z.string().optional(),
});

export const listChatsOutputSchema = z.object({
  items: z.array(ChatSchema),
  nextLink: z.string().optional(),
});

export function listChatsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_teams_list_chats',
    description: 'List chats for a user.',
    inputSchema: listChatsInputSchema,
    outputSchema: listChatsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listChatsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      let endpoint: string;
      if (input.cursor) {
        endpoint = input.cursor;
      } else if (input.userId) {
        endpoint = `/v1.0/users/${encodeURIComponent(input.userId)}/chats`;
      } else {
        endpoint = '/v1.0/me/chats';
      }

      const response = await platformProxy.get({
        // https://learn.microsoft.com/en-us/graph/api/chat-list
        endpoint,
        ...(input.cursor ? {} : { params: { $top: '50' } }),
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        items: providerResponse.value,
        ...(providerResponse['@odata.nextLink'] != null && { nextLink: providerResponse['@odata.nextLink'] }),
      };
    },
  });
}
