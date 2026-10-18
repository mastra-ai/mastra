// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const replyToChannelMessageInputSchema = z.object({
  teamId: z.string().describe('Team ID. Example: "57fb72d0-d811-46f4-8947-305e6072eaa5"'),
  channelId: z.string().describe('Channel ID. Example: "19:4b6bed8d24574f6a9e436813cb2617d8@thread.tacv2"'),
  messageId: z.string().describe('Message ID to reply to. Example: "1590776551682"'),
  bodyContent: z.string().describe('Message body content. Example: "Hello World"'),
  bodyContentType: z.enum(['text', 'html']).optional().describe('Content type of the body. Defaults to "html".'),
});

const ProviderItemBodySchema = z.object({
  contentType: z.string().optional(),
  content: z.string().optional(),
});

const ProviderChatMessageSchema = z.object({
  id: z.string(),
  replyToId: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  body: ProviderItemBodySchema.optional(),
});

export const replyToChannelMessageOutputSchema = z.object({
  id: z.string(),
  replyToId: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  bodyContentType: z.string().optional(),
  bodyContent: z.string().optional(),
});

export function replyToChannelMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_teams_reply_to_channel_message',
    description: 'Reply to a channel message thread.',
    inputSchema: replyToChannelMessageInputSchema,
    outputSchema: replyToChannelMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof replyToChannelMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://learn.microsoft.com/graph/api/channel-post-messagereply
        endpoint: `/v1.0/teams/${input.teamId}/channels/${input.channelId}/messages/${input.messageId}/replies`,
        data: {
          body: {
            contentType: input.bodyContentType || 'html',
            content: input.bodyContent,
          },
        },
        retries: 1,
      };

      const response = await platformProxy.post(config);

      const providerMessage = ProviderChatMessageSchema.parse(response.data);

      return {
        id: providerMessage.id,
        ...(providerMessage.replyToId !== undefined && { replyToId: providerMessage.replyToId }),
        ...(providerMessage.createdDateTime !== undefined && { createdDateTime: providerMessage.createdDateTime }),
        ...(providerMessage.lastModifiedDateTime !== undefined && {
          lastModifiedDateTime: providerMessage.lastModifiedDateTime,
        }),
        ...(providerMessage.body?.contentType !== undefined && { bodyContentType: providerMessage.body.contentType }),
        ...(providerMessage.body?.content !== undefined && { bodyContent: providerMessage.body.content }),
      };
    },
  });
}
