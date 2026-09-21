// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getReactionsInputSchema = z.object({
  channel_id: z.string().describe('Channel ID where the message was posted. Example: "C1234567890"'),
  timestamp: z.string().describe('Timestamp of the message to get reactions for. Example: "1648602352.215969"'),
  full: z.boolean().optional().describe('If true, always return the complete reaction list.'),
});

const ReactionSchema = z.object({
  name: z.string().describe('Name of the emoji reaction. Example: "grinning"'),
  count: z.number().describe('Number of users who reacted with this emoji'),
  users: z.array(z.string()).describe('List of user IDs who reacted with this emoji'),
});

export const getReactionsOutputSchema = z.object({
  type: z.string().describe('Type of the item (message, file, etc.). Example: "message"'),
  channel: z.string().describe('Channel ID where the message was posted'),
  message: z.object({
    type: z.string(),
    text: z.string().optional(),
    user: z.string(),
    ts: z.string(),
    team: z.string().optional(),
    reactions: z.array(ReactionSchema).optional(),
  }),
  permalink: z.string().optional().describe('Permanent link to the message'),
});

export function getReactionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_get_reactions',
    description: 'Retrieve all reactions attached to a specific message',
    inputSchema: getReactionsInputSchema,
    outputSchema: getReactionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getReactionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.com/methods/reactions.get
      const response = await platformProxy.get({
        endpoint: 'reactions.get',
        params: {
          channel: input.channel_id,
          timestamp: input.timestamp,
          ...(input.full !== undefined && { full: input.full.toString() }),
        },
        retries: 3,
      });

      if (!response.data.ok) {
        throw new platformProxy.ActionError({
          type: 'slack_api_error',
          message: response.data.error || 'Failed to get reactions',
          error: response.data.error,
        });
      }

      const message = response.data.message || {};

      return {
        type: response.data.type || 'message',
        channel: input.channel_id,
        message: {
          type: message.type || 'message',
          text: message.text,
          user: message.user,
          ts: message.ts,
          team: message.team,
          reactions:
            message.reactions?.map((reaction: { name: string; count: number; users: string[] }) => ({
              name: reaction.name,
              count: reaction.count,
              users: reaction.users,
            })) || [],
        },
        permalink: response.data.permalink,
      };
    },
  });
}
