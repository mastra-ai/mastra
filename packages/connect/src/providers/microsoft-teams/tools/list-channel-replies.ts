// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listChannelRepliesInputSchema = z.object({
  teamId: z.string().describe('Team ID. Example: "5d7a3b3e-8c9d-4e0f-a1b2-c3d4e5f6a7b8"'),
  channelId: z.string().describe('Channel ID. Example: "19:abc123@thread.tacv2"'),
  messageId: z.string().describe('Parent message ID to fetch replies for. Example: "1234567890"'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor (full @odata.nextLink URL) from the previous response. Omit for the first page.'),
});

const FromSchema = z.object({
  user: z
    .object({
      id: z.string().optional(),
      displayName: z.string().optional(),
    })
    .nullish(),
  application: z
    .object({
      id: z.string().optional(),
      displayName: z.string().optional(),
    })
    .nullish(),
});

const ProviderReplySchema = z.object({
  id: z.string(),
  replyToId: z.string().nullish(),
  createdDateTime: z.string().nullish(),
  lastModifiedDateTime: z.string().nullish(),
  deletedDateTime: z.string().nullish(),
  subject: z.string().nullish(),
  body: z
    .object({
      contentType: z.enum(['text', 'html']).or(z.string()).optional(),
      content: z.string().optional(),
    })
    .nullish(),
  from: FromSchema.nullish(),
  channelIdentity: z
    .object({
      teamId: z.string().optional(),
      channelId: z.string().optional(),
    })
    .nullish(),
  messageType: z.string().nullish(),
  importance: z.enum(['normal', 'high', 'urgent']).or(z.string()).nullish(),
  reactions: z
    .array(
      z.object({
        reactionType: z.string().nullish(),
        user: z
          .object({
            user: z
              .object({
                id: z.string().optional(),
                displayName: z.string().optional(),
              })
              .optional(),
          })
          .nullish(),
        createdDateTime: z.string().nullish(),
      }),
    )
    .nullish(),
});

const ProviderResponseSchema = z.object({
  value: z.array(ProviderReplySchema),
  '@odata.nextLink': z.string().optional(),
  '@odata.count': z.number().optional(),
});

const ReplyOutputSchema = z.object({
  id: z.string(),
  replyToId: z.string().nullish(),
  createdDateTime: z.string().nullish(),
  lastModifiedDateTime: z.string().nullish(),
  deletedDateTime: z.string().nullish(),
  subject: z.string().nullish(),
  bodyContentType: z.enum(['text', 'html']).or(z.string()).nullish(),
  bodyContent: z.string().nullish(),
  fromUserId: z.string().nullish(),
  fromUserDisplayName: z.string().nullish(),
  fromApplicationId: z.string().nullish(),
  fromApplicationDisplayName: z.string().nullish(),
  teamId: z.string().nullish(),
  channelId: z.string().nullish(),
  messageType: z.string().nullish(),
  importance: z.enum(['normal', 'high', 'urgent']).or(z.string()).nullish(),
  reactions: z
    .array(
      z.object({
        reactionType: z.string().nullish(),
        userId: z.string().nullish(),
        userDisplayName: z.string().nullish(),
        createdDateTime: z.string().nullish(),
      }),
    )
    .nullish(),
});

export const listChannelRepliesOutputSchema = z.object({
  items: z.array(ReplyOutputSchema),
  next_cursor: z
    .string()
    .optional()
    .describe('Pagination cursor to fetch the next page. Pass this as the cursor input in the next request.'),
});

export function listChannelRepliesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_teams_list_channel_replies',
    description: 'List replies under a channel message thread',
    inputSchema: listChannelRepliesInputSchema,
    outputSchema: listChannelRepliesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listChannelRepliesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/channel-list-messagereplies
      const response = await platformProxy.get({
        endpoint:
          input.cursor || `/v1.0/teams/${input.teamId}/channels/${input.channelId}/messages/${input.messageId}/replies`,
        params: input.cursor ? {} : { $top: 50 },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      const items = providerResponse.value.map(reply => {
        const fromUser = reply.from?.user;
        const fromApp = reply.from?.application;

        return {
          id: reply.id,
          replyToId: reply.replyToId,
          createdDateTime: reply.createdDateTime,
          lastModifiedDateTime: reply.lastModifiedDateTime,
          deletedDateTime: reply.deletedDateTime,
          subject: reply.subject,
          bodyContentType: reply.body?.contentType,
          bodyContent: reply.body?.content,
          fromUserId: fromUser?.id,
          fromUserDisplayName: fromUser?.displayName,
          fromApplicationId: fromApp?.id,
          fromApplicationDisplayName: fromApp?.displayName,
          teamId: reply.channelIdentity?.teamId,
          channelId: reply.channelIdentity?.channelId,
          messageType: reply.messageType,
          importance: reply.importance,
          reactions: reply.reactions?.map(reaction => ({
            reactionType: reaction.reactionType,
            userId: reaction.user?.user?.id,
            userDisplayName: reaction.user?.user?.displayName,
            createdDateTime: reaction.createdDateTime,
          })),
        };
      });

      return {
        items,
        ...(providerResponse['@odata.nextLink'] != null && {
          next_cursor: providerResponse['@odata.nextLink'],
        }),
      };
    },
  });
}
