// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listChannelMessagesInputSchema = z.object({
  team_id: z
    .string()
    .optional()
    .describe('Team ID. Example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890". Required when next_link is not provided.'),
  channel_id: z
    .string()
    .optional()
    .describe('Channel ID. Example: "19:abc123@thread.tacv2". Required when next_link is not provided.'),
  next_link: z
    .string()
    .optional()
    .describe('Pagination cursor (@odata.nextLink) from the previous response. Omit for the first page.'),
});

const FromSchema = z.object({
  user: z
    .object({
      id: z.string().optional(),
      displayName: z.string().optional(),
      userIdentityType: z.string().optional(),
    })
    .optional(),
});

const BodySchema = z.object({
  contentType: z.string().optional(),
  content: z.string().optional(),
});

const ReactionSchema = z.object({
  reactionType: z.string().optional(),
  user: z
    .object({
      id: z.string().optional(),
      displayName: z.string().optional(),
    })
    .optional(),
  createdDateTime: z.string().optional(),
});

const AttachmentSchema = z.object({
  id: z.string().optional(),
  contentType: z.string().optional(),
  contentUrl: z.string().optional(),
  name: z.string().optional(),
});

const MessageSchema = z.object({
  id: z.string(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  deletedDateTime: z.string().nullable().optional(),
  from: FromSchema.nullable().optional(),
  body: BodySchema.nullable().optional(),
  importance: z.string().optional(),
  reactions: z.array(ReactionSchema).optional(),
  attachments: z.array(AttachmentSchema).optional(),
  replyToId: z.string().nullable().optional(),
  messageType: z.string().optional(),
  subject: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
});

const ProviderResponseSchema = z.object({
  '@odata.nextLink': z.string().optional(),
  '@odata.deltaLink': z.string().optional(),
  value: z.array(MessageSchema),
});

const OutputMessageSchema = z.object({
  id: z.string(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  deletedDateTime: z.string().optional(),
  from: z
    .object({
      user: z
        .object({
          id: z.string().optional(),
          displayName: z.string().optional(),
          userIdentityType: z.string().optional(),
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
  importance: z.string().optional(),
  reactions: z
    .array(
      z.object({
        reactionType: z.string().optional(),
        user: z
          .object({
            id: z.string().optional(),
            displayName: z.string().optional(),
          })
          .optional(),
        createdDateTime: z.string().optional(),
      }),
    )
    .optional(),
  attachments: z
    .array(
      z.object({
        id: z.string().optional(),
        contentType: z.string().optional(),
        contentUrl: z.string().optional(),
        name: z.string().optional(),
      }),
    )
    .optional(),
  replyToId: z.string().optional(),
  messageType: z.string().optional(),
  subject: z.string().optional(),
  summary: z.string().optional(),
});

export const listChannelMessagesOutputSchema = z.object({
  messages: z.array(OutputMessageSchema),
  next_link: z.string().optional(),
});

export function listChannelMessagesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_teams_list_channel_messages',
    description: 'List root messages in a channel.',
    inputSchema: listChannelMessagesInputSchema,
    outputSchema: listChannelMessagesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listChannelMessagesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if (!input.next_link) {
        if (!input.team_id) {
          throw new platformProxy.ActionError({
            type: 'invalid_input',
            message: 'team_id is required when next_link is not provided.',
          });
        }
        if (!input.channel_id) {
          throw new platformProxy.ActionError({
            type: 'invalid_input',
            message: 'channel_id is required when next_link is not provided.',
          });
        }
      }

      // https://learn.microsoft.com/graph/api/channel-list-messages
      let response;
      if (input.next_link) {
        response = await platformProxy.get({
          endpoint: input.next_link,
          retries: 3,
        });
      } else {
        response = await platformProxy.get({
          endpoint: `/v1.0/teams/${input.team_id}/channels/${input.channel_id}/messages`,
          params: {
            $top: '50',
          },
          retries: 3,
        });
      }

      const providerData = ProviderResponseSchema.parse(response.data);

      const messages = providerData.value.map(message => ({
        id: message.id,
        ...(message.createdDateTime !== undefined && { createdDateTime: message.createdDateTime }),
        ...(message.lastModifiedDateTime !== undefined && { lastModifiedDateTime: message.lastModifiedDateTime }),
        ...(message.deletedDateTime != null && { deletedDateTime: message.deletedDateTime }),
        ...(message.from !== undefined &&
          message.from !== null && {
            from: {
              ...(message.from.user !== undefined && {
                user: {
                  ...(message.from.user.id !== undefined && { id: message.from.user.id }),
                  ...(message.from.user.displayName !== undefined && { displayName: message.from.user.displayName }),
                  ...(message.from.user.userIdentityType !== undefined && {
                    userIdentityType: message.from.user.userIdentityType,
                  }),
                },
              }),
            },
          }),
        ...(message.body !== undefined &&
          message.body !== null && {
            body: {
              ...(message.body.contentType !== undefined && { contentType: message.body.contentType }),
              ...(message.body.content !== undefined && { content: message.body.content }),
            },
          }),
        ...(message.importance !== undefined && { importance: message.importance }),
        ...(message.reactions !== undefined && {
          reactions: message.reactions.map(reaction => ({
            ...(reaction.reactionType !== undefined && { reactionType: reaction.reactionType }),
            ...(reaction.user !== undefined && {
              user: {
                ...(reaction.user.id !== undefined && { id: reaction.user.id }),
                ...(reaction.user.displayName !== undefined && { displayName: reaction.user.displayName }),
              },
            }),
            ...(reaction.createdDateTime !== undefined && { createdDateTime: reaction.createdDateTime }),
          })),
        }),
        ...(message.attachments !== undefined && {
          attachments: message.attachments.map(attachment => ({
            ...(attachment.id !== undefined && { id: attachment.id }),
            ...(attachment.contentType !== undefined && { contentType: attachment.contentType }),
            ...(attachment.contentUrl !== undefined && { contentUrl: attachment.contentUrl }),
            ...(attachment.name !== undefined && { name: attachment.name }),
          })),
        }),
        ...(message.replyToId != null && { replyToId: message.replyToId }),
        ...(message.messageType !== undefined && { messageType: message.messageType }),
        ...(message.subject != null && { subject: message.subject }),
        ...(message.summary != null && { summary: message.summary }),
      }));

      return {
        messages,
        ...(providerData['@odata.nextLink'] !== undefined && { next_link: providerData['@odata.nextLink'] }),
      };
    },
  });
}
