// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteScheduledMessageInputSchema = z.object({
  channel: z.string().describe('The channel ID the scheduled message is posting to. Example: "C123456789"'),
  scheduled_message_id: z
    .string()
    .describe('The scheduled_message_id returned from chat.scheduleMessage. Example: "Q1234ABCD"'),
});

export const deleteScheduledMessageOutputSchema = z.object({
  ok: z.boolean().describe('Whether the operation was successful'),
});

export function deleteScheduledMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_delete_scheduled_message',
    description: 'Cancel a scheduled message',
    inputSchema: deleteScheduledMessageInputSchema,
    outputSchema: deleteScheduledMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteScheduledMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://api.slack.com/methods/chat.deleteScheduledMessage
        endpoint: 'chat.deleteScheduledMessage',
        data: {
          channel: input.channel,
          scheduled_message_id: input.scheduled_message_id,
        },
        retries: 3,
      });

      if (!response.data.ok) {
        throw new platformProxy.ActionError({
          type: 'slack_error',
          message: response.data.error || 'Unknown error deleting scheduled message',
          error: response.data.error,
        });
      }

      return {
        ok: response.data.ok,
      };
    },
  });
}
