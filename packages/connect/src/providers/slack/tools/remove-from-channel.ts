// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const removeFromChannelInputSchema = z.object({
  channel_id: z.string().describe('The ID of the channel to remove the user from. Example: "C1234567890"'),
  user_id: z.string().describe('The ID of the user to remove from the channel. Example: "U1234567890"'),
});

export const removeFromChannelOutputSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
});

export function removeFromChannelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_remove_from_channel',
    description: 'Remove a user from a channel',
    inputSchema: removeFromChannelInputSchema,
    outputSchema: removeFromChannelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof removeFromChannelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.com/methods/conversations.kick
      const response = await platformProxy.post({
        endpoint: 'conversations.kick',
        data: {
          channel: input.channel_id,
          user: input.user_id,
        },
        retries: 3,
      });

      if (!response.data.ok) {
        throw new platformProxy.ActionError({
          type: 'slack_error',
          message: response.data.error || 'Failed to remove user from channel',
          slack_error: response.data.error,
        });
      }

      return {
        ok: response.data.ok,
        error: response.data.error || undefined,
      };
    },
  });
}
