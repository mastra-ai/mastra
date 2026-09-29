// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const removeReactionInputSchema = z.object({
  channel_id: z.string().describe('Channel ID where the message was posted. Example: "C1234567890"'),
  timestamp: z.string().describe('Timestamp of the message to remove the reaction from. Example: "1234567890.123456"'),
  reaction_name: z.string().describe('Name of the emoji reaction to remove. Example: "thumbsup"'),
});

export const removeReactionOutputSchema = z.object({
  ok: z.boolean().describe('Whether the operation was successful'),
  error: z.string().optional().describe('Error message if the operation failed'),
});

export function removeReactionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_remove_reaction',
    description: 'Remove an emoji reaction from a specific message',
    inputSchema: removeReactionInputSchema,
    outputSchema: removeReactionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof removeReactionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.com/methods/reactions.remove
      const response = await platformProxy.post({
        endpoint: 'reactions.remove',
        data: {
          channel: input.channel_id,
          timestamp: input.timestamp,
          name: input.reaction_name,
        },
        retries: 3,
      });

      if (!response.data || response.data.ok !== true) {
        return {
          ok: false,
          error: response.data?.error || 'Unknown error',
        };
      }

      return {
        ok: true,
        error: undefined,
      };
    },
  });
}
