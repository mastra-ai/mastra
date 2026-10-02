// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getChannelMembersInputSchema = z.object({
  channel_id: z.string().describe('Slack channel ID to list members for. Example: "C0123456789"'),
  cursor: z.string().optional().describe('Pagination cursor from previous response. Omit for first page.'),
  limit: z.number().optional().describe('Maximum number of items to return. Default is 100, max is 1000.'),
});

export const getChannelMembersOutputSchema = z.object({
  members: z.array(z.string()).describe('List of user IDs belonging to the conversation members'),
  next_cursor: z.string().optional().describe('Pagination cursor for next page, or omitted if no more results'),
});

export function getChannelMembersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_get_channel_members',
    description: 'List members in a Slack channel',
    inputSchema: getChannelMembersInputSchema,
    outputSchema: getChannelMembersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getChannelMembersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.com/methods/conversations.members
      const config = {
        endpoint: 'conversations.members',
        params: {
          channel: input.channel_id,
          ...(input.cursor && { cursor: input.cursor }),
          ...(input.limit && { limit: input.limit.toString() }),
        },
        retries: 3,
      };

      const response = await platformProxy.get(config);

      if (!response.data.ok) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: response.data.error || 'Unknown error from Slack API',
          slack_error: response.data.error,
        });
      }

      return {
        members: response.data.members || [],
        next_cursor: response.data.response_metadata?.next_cursor || undefined,
      };
    },
  });
}
