// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getUserPresenceInputSchema = z.object({
  user_id: z
    .string()
    .optional()
    .describe('User ID to get presence info on. Defaults to the authed user. Example: "U1234567890"'),
});

export const getUserPresenceOutputSchema = z.object({
  presence: z.enum(['active', 'away']).or(z.string()).describe('User\'s presence status: "active" or "away"'),
  online: z.boolean().optional().describe('True if the user has a client currently connected to Slack'),
  auto_away: z.boolean().optional().describe("True if Slack servers haven't detected activity in the last 10 minutes"),
  manual_away: z.boolean().optional().describe('True if the user has manually set their presence to away'),
  connection_count: z.number().optional().describe('Count of total connections'),
  last_activity: z.number().optional().describe('Last activity seen by Slack servers (Unix timestamp)'),
});

export function getUserPresenceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_get_user_presence',
    description: 'Check if a user is online or away',
    inputSchema: getUserPresenceInputSchema,
    outputSchema: getUserPresenceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getUserPresenceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.com/methods/users.getPresence
      const response = await platformProxy.get({
        endpoint: '/api/users.getPresence',
        params: {
          ...(input.user_id && { user: input.user_id }),
        },
        retries: 3,
      });

      if (!response.data.ok) {
        throw new platformProxy.ActionError({
          type: 'slack_error',
          message: response.data.error || 'Failed to get user presence',
          slack_error: response.data.error,
        });
      }

      return {
        presence: response.data.presence,
        online: response.data.online ?? undefined,
        auto_away: response.data.auto_away ?? undefined,
        manual_away: response.data.manual_away ?? undefined,
        connection_count: response.data.connection_count ?? undefined,
        last_activity: response.data.last_activity ?? undefined,
      };
    },
  });
}
