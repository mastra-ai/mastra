// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createChannelMessageInputSchema = z.object({
  teamId: z.string().describe('Team ID. Example: "19:xxxxxxxxxxxxxxxxxxxxxxxxxx@thread.tacv2"'),
  channelId: z.string().describe('Channel ID. Example: "19:xxxxxxxxxxxxxxxxxxxxxxxxxx@thread.tacv2"'),
  body: z.object({
    contentType: z.enum(['html', 'text']).describe('Content type. Example: "html"'),
    content: z.string().describe('Message content in HTML or plain text. Example: "<p>Hello team!</p>"'),
  }),
  attachments: z
    .array(
      z.object({
        id: z.string().describe('Unique ID for the attachment'),
        contentType: z.string().describe('MIME type of the attachment. Example: "application/vnd.microsoft.card.hero"'),
        contentUrl: z.string().optional().describe('URL for the attachment'),
        name: z.string().optional().describe('Name of the attachment'),
        content: z.string().optional().describe('JSON-encoded content for adaptive cards'),
      }),
    )
    .optional()
    .describe('Optional attachments for the message'),
});

const ProviderChatMessageSchema = z.object({
  id: z.string(),
  createdDateTime: z.string(),
  from: z
    .object({
      user: z
        .object({
          id: z.string().optional(),
          displayName: z.string().nullable().optional(),
        })
        .optional(),
    })
    .optional(),
  body: z.object({
    contentType: z.enum(['html', 'text', 'markdown']).or(z.string()),
    content: z.string(),
  }),
  attachments: z
    .array(
      z.object({
        id: z.string(),
        contentType: z.string(),
        contentUrl: z.string().nullable().optional(),
        name: z.string().nullable().optional(),
        content: z.string().nullable().optional(),
      }),
    )
    .optional(),
});

export const createChannelMessageOutputSchema = z.object({
  id: z.string().describe('Message ID'),
  createdDateTime: z.string().describe('Creation timestamp'),
  from: z
    .object({
      userId: z.string().optional(),
      displayName: z.string().optional(),
    })
    .optional()
    .describe('Sender information'),
  body: z.object({
    contentType: z.enum(['html', 'text', 'markdown']).or(z.string()),
    content: z.string(),
  }),
  attachments: z
    .array(
      z.object({
        id: z.string(),
        contentType: z.string(),
        contentUrl: z.string().optional(),
        name: z.string().optional(),
        content: z.string().optional(),
      }),
    )
    .optional(),
});

export function createChannelMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_teams_create_channel_message',
    description: 'Post a root message in a channel',
    inputSchema: createChannelMessageInputSchema,
    outputSchema: createChannelMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createChannelMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: {
        body: { contentType: string; content: string };
        attachments?: Array<{
          id: string;
          contentType: string;
          contentUrl?: string;
          name?: string;
          content?: string;
        }>;
      } = {
        body: {
          contentType: input.body.contentType,
          content: input.body.content,
        },
      };

      if (input.attachments !== undefined && input.attachments.length > 0) {
        requestBody.attachments = input.attachments.map(att => ({
          id: att.id,
          contentType: att.contentType,
          ...(att.contentUrl !== undefined && { contentUrl: att.contentUrl }),
          ...(att.name !== undefined && { name: att.name }),
          ...(att.content !== undefined && { content: att.content }),
        }));
      }

      // https://learn.microsoft.com/graph/api/channel-post-messages
      const response = await platformProxy.post({
        endpoint: `/v1.0/teams/${input.teamId}/channels/${input.channelId}/messages`,
        data: requestBody,
        retries: 3,
      });

      const providerMessage = ProviderChatMessageSchema.parse(response.data);

      return {
        id: providerMessage.id,
        createdDateTime: providerMessage.createdDateTime,
        ...(providerMessage.from !== undefined && {
          from: {
            ...(providerMessage.from.user?.id !== undefined && {
              userId: providerMessage.from.user.id,
            }),
            ...(providerMessage.from.user?.displayName != null && {
              displayName: providerMessage.from.user.displayName,
            }),
          },
        }),
        body: {
          contentType: providerMessage.body.contentType,
          content: providerMessage.body.content,
        },
        ...(providerMessage.attachments !== undefined &&
          providerMessage.attachments.length > 0 && {
            attachments: providerMessage.attachments.map(att => ({
              id: att.id,
              contentType: att.contentType,
              ...(att.contentUrl != null && { contentUrl: att.contentUrl }),
              ...(att.name != null && { name: att.name }),
              ...(att.content != null && { content: att.content }),
            })),
          }),
      };
    },
  });
}
