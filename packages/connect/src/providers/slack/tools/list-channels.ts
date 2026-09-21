// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const ConversationSchema = z.object({
  id: z.string(),
  name: z.string(),
  created: z.number(),
  creator: z.string(),
  is_archived: z.boolean(),
  is_general: z.boolean(),
  is_private: z.boolean(),
  is_mpim: z.boolean(),
  is_im: z.boolean(),
  num_members: z.number().optional(),
});

export const listChannelsInputSchema = z.object({
  types: z
    .string()
    .optional()
    .describe(
      'Comma-separated list of conversation types to filter by. Options: public_channel, private_channel, mpim, im. Default: public_channel.',
    ),
  cursor: z.string().optional().describe('Pagination cursor from previous response. Omit for first page.'),
  limit: z.number().optional().describe('Maximum number of conversations to return (1-200). Default: 100.'),
});

export const listChannelsOutputSchema = z.object({
  conversations: z.array(ConversationSchema),
  next_cursor: z.string().optional(),
  total: z.number(),
});

export function listChannelsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_list_channels',
    description: 'List Slack conversations with optional type filters and cursor pagination.',
    inputSchema: listChannelsInputSchema,
    outputSchema: listChannelsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listChannelsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config = {
        // https://api.slack.com/methods/conversations.list
        endpoint: 'conversations.list',
        params: {
          types: input.types || 'public_channel',
          limit: input.limit || 100,
          ...(input.cursor && { cursor: input.cursor }),
        },
        retries: 3,
      };

      const response = await platformProxy.get(config);

      const channels = response.data.channels || [];
      const responseMetadata = response.data.response_metadata || {};
      const nextCursor = responseMetadata.next_cursor || undefined;

      const conversations = channels.map((channel: any) => ({
        id: channel.id,
        name: channel.name || '',
        created: channel.created || 0,
        creator: channel.creator || '',
        is_archived: channel.is_archived || false,
        is_general: channel.is_general || false,
        is_private: channel.is_private || false,
        is_mpim: channel.is_mpim || false,
        is_im: channel.is_im || false,
        num_members: channel.num_members,
      }));

      return {
        conversations,
        next_cursor: nextCursor,
        total: conversations.length,
      };
    },
  });
}
