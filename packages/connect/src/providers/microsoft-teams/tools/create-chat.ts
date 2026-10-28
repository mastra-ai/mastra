// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const MemberSchema = z.object({
  userId: z.string().describe('The Azure AD user ID of the member. Example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"'),
  roles: z
    .array(z.enum(['owner', 'guest']))
    .optional()
    .describe('Roles for this member. Use "owner" to grant ownership; omit or pass [] for a regular member.'),
});

export const createChatInputSchema = z.object({
  chatType: z.enum(['oneOnOne', 'group']).describe('The type of chat. oneOnOne for 1:1 chats, group for group chats.'),
  topic: z.string().optional().describe('The topic or title of the chat. Required for group chats.'),
  members: z
    .array(MemberSchema)
    .min(1)
    .describe('List of members to add to the chat. Must include at least one member for group chats.'),
});

const ProviderMemberSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  roles: z.array(z.string()).optional(),
});

const ProviderChatSchema = z.object({
  id: z.string(),
  chatType: z.enum(['oneOnOne', 'group', 'meeting', 'unknownFutureValue']).or(z.string()),
  topic: z.string().nullable().optional(),
  createdDateTime: z.string().optional(),
  lastUpdatedDateTime: z.string().optional(),
  members: z.array(ProviderMemberSchema).optional(),
});

export const createChatOutputSchema = z.object({
  id: z.string().describe('The unique identifier of the chat.'),
  chatType: z.enum(['oneOnOne', 'group', 'meeting', 'unknownFutureValue']).or(z.string()),
  topic: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastUpdatedDateTime: z.string().optional(),
  members: z
    .array(
      z.object({
        id: z.string(),
        displayName: z.string().optional(),
        roles: z.array(z.string()).optional(),
      }),
    )
    .optional(),
});

export function createChatTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_teams_create_chat',
    description: 'Create a one-on-one or group chat.',
    inputSchema: createChatInputSchema,
    outputSchema: createChatOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createChatOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Validate that group chats have a topic
      if (input.chatType === 'group' && !input.topic) {
        throw new platformProxy.ActionError({
          type: 'missing_topic',
          message: 'Topic is required when creating a group chat.',
        });
      }

      // Build conversation members array for the request
      const members = input.members.map(member => ({
        '@odata.type': '#microsoft.graph.aadUserConversationMember',
        roles: member.roles && member.roles.length > 0 ? member.roles : [],
        'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${member.userId}')`,
      }));

      const requestBody: {
        chatType: string;
        topic?: string;
        members: unknown[];
      } = {
        chatType: input.chatType,
        members: members,
      };

      if (input.chatType === 'group' && input.topic !== undefined) {
        requestBody.topic = input.topic;
      }

      // https://learn.microsoft.com/en-us/graph/api/chat-post
      const response = await platformProxy.post({
        endpoint: '/v1.0/chats',
        data: requestBody,
        retries: 3,
      });

      const chat = ProviderChatSchema.parse(response.data);

      return {
        id: chat.id,
        chatType: chat.chatType,
        ...(chat.topic != null && chat.topic !== undefined && { topic: chat.topic }),
        ...(chat.createdDateTime !== undefined && { createdDateTime: chat.createdDateTime }),
        ...(chat.lastUpdatedDateTime !== undefined && {
          lastUpdatedDateTime: chat.lastUpdatedDateTime,
        }),
        ...(chat.members !== undefined && {
          members: chat.members.map(member => ({
            id: member.id,
            ...(member.displayName !== undefined && {
              displayName: member.displayName,
            }),
            ...(member.roles !== undefined && { roles: member.roles }),
          })),
        }),
      };
    },
  });
}
