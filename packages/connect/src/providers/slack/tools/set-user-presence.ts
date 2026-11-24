// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const setUserPresenceInputSchema = z.object({
  presence: z
    .enum(['online', 'away'])
    .describe('User presence status. Use "online" to set presence to auto (active) or "away" to set presence to away.'),
});

export const setUserPresenceOutputSchema = z.object({
  ok: z.boolean().describe('Whether the presence was set successfully'),
  error: z.string().optional().describe('Error message if the request failed'),
});

export function setUserPresenceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_set_user_presence',
    description: "Set a user's presence to online or away",
    inputSchema: setUserPresenceInputSchema,
    outputSchema: setUserPresenceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof setUserPresenceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.com/methods/users.setPresence
      // Map "online" to "auto" (Slack's term for activity-based presence)
      const presenceValue = input.presence === 'online' ? 'auto' : 'away';

      const response = await platformProxy.post({
        endpoint: 'users.setPresence',
        data: {
          presence: presenceValue,
        },
        retries: 3,
      });

      if (!response.data || response.data.ok !== true) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: response.data?.error || 'Failed to set user presence',
          presence: input.presence,
        });
      }

      return {
        ok: response.data.ok,
        error: response.data.error || undefined,
      };
    },
  });
}
