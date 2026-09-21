// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const addReactionInputSchema = z.object({
  channel_id: z.string().describe('The channel ID where the message is located. Example: "C1234567890"'),
  timestamp: z.string().describe('The timestamp of the message to react to. Example: "1234567890.123456"'),
  emoji_name: z.string().describe('The name of the emoji to use (without colons). Example: "thumbsup"'),
});

export const addReactionOutputSchema = z.object({
  ok: z.boolean(),
});

export function addReactionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_add_reaction',
    description: 'Add an emoji reaction to a specific Slack message',
    inputSchema: addReactionInputSchema,
    outputSchema: addReactionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof addReactionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.com/methods/reactions.add
      const response = await platformProxy.post({
        endpoint: 'reactions.add',
        data: {
          channel: input.channel_id,
          timestamp: input.timestamp,
          name: input.emoji_name,
        },
        retries: 3,
      });

      if (!response.data.ok) {
        throw new platformProxy.ActionError({
          type: 'slack_api_error',
          message: response.data.error || 'Failed to add reaction',
          error: response.data.error,
        });
      }

      return {
        ok: response.data.ok,
      };
    },
  });
}
