// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listChatMembersInputSchema = z.object({
  chat_id: z.string().describe('The unique identifier of the chat. Example: "19:xxxxx@thread.v2"'),
  cursor: z.string().optional().describe('Full URL from @odata.nextLink for pagination. Omit for the first page.'),
});

const ConversationMemberSchema = z.object({
  id: z.string().optional(),
  roles: z.array(z.string()).optional(),
  displayName: z.string().optional().nullable(),
  visibleHistoryStartDateTime: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  tenantId: z.string().optional().nullable(),
});

const ListMembersResponseSchema = z.object({
  '@odata.nextLink': z.string().optional(),
  value: z.array(ConversationMemberSchema),
});

const MemberOutputSchema = z.object({
  id: z.string().optional(),
  roles: z.array(z.string()).optional(),
  display_name: z.string().optional(),
  visible_history_start_date_time: z.string().optional(),
  user_id: z.string().optional(),
  email: z.string().optional(),
  tenant_id: z.string().optional(),
});

export const listChatMembersOutputSchema = z.object({
  members: z.array(MemberOutputSchema),
  next_cursor: z.string().optional(),
});

export function listChatMembersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_teams_list_chat_members',
    description: 'List members in a chat',
    inputSchema: listChatMembersInputSchema,
    outputSchema: listChatMembersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listChatMembersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/chat-list-members
      const response = await platformProxy.get({
        endpoint: input.cursor || `/v1.0/chats/${input.chat_id}/members`,
        retries: 3,
      });

      const validated = ListMembersResponseSchema.parse(response.data);

      const members = validated.value.map(member => ({
        ...(member.id !== undefined && { id: member.id }),
        ...(member.roles !== undefined && { roles: member.roles }),
        ...(member.displayName != null && { display_name: member.displayName }),
        ...(member.visibleHistoryStartDateTime != null && {
          visible_history_start_date_time: member.visibleHistoryStartDateTime,
        }),
        ...(member.userId != null && { user_id: member.userId }),
        ...(member.email != null && { email: member.email }),
        ...(member.tenantId != null && { tenant_id: member.tenantId }),
      }));

      return {
        members,
        ...(validated['@odata.nextLink'] !== undefined && { next_cursor: validated['@odata.nextLink'] }),
      };
    },
  });
}
