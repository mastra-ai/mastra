// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const openDmInputSchema = z.object({
  user_ids: z
    .array(z.string())
    .min(1)
    .describe(
      'User IDs to open a direct message with. For a 1:1 DM, provide a single user ID. For a multi-person DM, provide multiple user IDs. Example: ["U1234567890"]',
    ),
});

export const openDmOutputSchema = z.object({
  channel_id: z.string().describe('The ID of the opened DM channel'),
  channel_name: z.string().describe('The name of the channel (for multi-person DMs this will be a generated name)'),
});

export function openDmTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_open_dm',
    description: 'Open a direct or multi-person DM for specified users',
    inputSchema: openDmInputSchema,
    outputSchema: openDmOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof openDmOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.com/methods/conversations.open
      const response = await platformProxy.post({
        endpoint: 'conversations.open',
        data: {
          users: input.user_ids.join(','),
        },
        retries: 3,
      });

      if (!response.data.ok) {
        throw new platformProxy.ActionError({
          type: 'slack_api_error',
          message: response.data.error || 'Failed to open DM',
          user_ids: input.user_ids,
        });
      }

      return {
        channel_id: response.data.channel.id,
        channel_name: response.data.channel.name || 'direct-message',
      };
    },
  });
}
