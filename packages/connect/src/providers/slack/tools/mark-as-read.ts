// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const markAsReadInputSchema = z.object({
  channel_id: z.string().describe('The channel ID to mark as read. Example: "C02MB5ZABA7"'),
  message_ts: z.string().describe('Timestamp of the message to mark as read. Example: "1234567890.123456"'),
});

export const markAsReadOutputSchema = z.object({
  ok: z.boolean().describe('Whether the operation succeeded'),
});

export function markAsReadTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_mark_as_read',
    description: "Move a conversation's read cursor to a specific message timestamp",
    inputSchema: markAsReadInputSchema,
    outputSchema: markAsReadOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof markAsReadOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config = {
        // https://api.slack.com/methods/conversations.mark
        endpoint: 'conversations.mark',
        data: {
          channel: input.channel_id,
          ts: input.message_ts,
        },
        retries: 3,
      };

      const response = await platformProxy.post(config);

      if (!response.data.ok) {
        throw new platformProxy.ActionError({
          type: 'slack_error',
          message: response.data.error || 'Failed to mark conversation as read',
          channel_id: input.channel_id,
          message_ts: input.message_ts,
        });
      }

      return {
        ok: response.data.ok,
      };
    },
  });
}
