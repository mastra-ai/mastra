// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteMessageInputSchema = z.object({
  channel_id: z.string().describe('Channel ID containing the message. Example: "C1234567890"'),
  message_ts: z.string().describe('Timestamp of the message to delete. Example: "1405894322.002768"'),
});

export const deleteMessageOutputSchema = z.object({
  ok: z.boolean(),
  channel: z.string(),
  ts: z.string(),
});

export function deleteMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_delete_message',
    description: 'Delete a message from a channel',
    inputSchema: deleteMessageInputSchema,
    outputSchema: deleteMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://api.slack.com/methods/chat.delete
        endpoint: 'chat.delete',
        data: {
          channel: input.channel_id,
          ts: input.message_ts,
        },
        retries: 3,
      });

      if (!response.data.ok) {
        throw new platformProxy.ActionError({
          type: 'slack_api_error',
          message: response.data.error || 'Failed to delete message',
          error: response.data.error,
        });
      }

      return {
        ok: response.data.ok,
        channel: response.data.channel,
        ts: response.data.ts,
      };
    },
  });
}
