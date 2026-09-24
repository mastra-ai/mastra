// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getMessagePermalinkInputSchema = z.object({
  channel_id: z
    .string()
    .describe('The ID of the conversation or channel containing the message. Example: "C123ABC456"'),
  message_ts: z
    .string()
    .describe('The timestamp of the message, uniquely identifying it within a channel. Example: "1358546515.000008"'),
});

export const getMessagePermalinkOutputSchema = z.object({
  permalink: z.string().describe('The permalink URL for the message'),
});

export function getMessagePermalinkTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_get_message_permalink',
    description: 'Get a permanent URL for a message',
    inputSchema: getMessagePermalinkInputSchema,
    outputSchema: getMessagePermalinkOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getMessagePermalinkOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.com/methods/chat.getPermalink
      const response = await platformProxy.get({
        endpoint: 'chat.getPermalink',
        params: {
          channel: input.channel_id,
          message_ts: input.message_ts,
        },
        retries: 3,
      });

      if (!response.data || !response.data.ok) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: response.data?.error || 'Failed to get message permalink',
          channel_id: input.channel_id,
          message_ts: input.message_ts,
        });
      }

      return {
        permalink: response.data.permalink,
      };
    },
  });
}
