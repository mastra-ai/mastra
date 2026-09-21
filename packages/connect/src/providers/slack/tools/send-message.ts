// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const sendMessageInputSchema = z.object({
  channel_id: z.string().describe('Channel ID to send the message to. Example: "C1234567890"'),
  text: z.string().describe('Text content of the message to send. Example: "Hello world"'),
});

export const sendMessageOutputSchema = z.object({
  ok: z.boolean(),
  channel: z.string(),
  ts: z.string().describe('Timestamp ID of the sent message'),
  message: z
    .object({
      type: z.string(),
      user: z.string(),
      text: z.string(),
      ts: z.string(),
      team: z.string().optional(),
      bot_id: z.string().optional(),
      app_id: z.string().optional(),
    })
    .optional(),
});

export function sendMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_send_message',
    description: 'Send a message to a channel',
    inputSchema: sendMessageInputSchema,
    outputSchema: sendMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof sendMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.com/methods/chat.postMessage
      const response = await platformProxy.post({
        endpoint: 'chat.postMessage',
        data: {
          channel: input.channel_id,
          text: input.text,
        },
        retries: 3,
      });

      if (!response.data || !response.data.ok) {
        throw new platformProxy.ActionError({
          type: 'slack_error',
          message: response.data?.error || 'Failed to send message',
          response: response.data,
        });
      }

      const message = response.data.message;

      return {
        ok: response.data.ok,
        channel: response.data.channel,
        ts: response.data.ts,
        message: message
          ? {
              type: message.type,
              user: message.user,
              text: message.text,
              ts: message.ts,
              team: message.team,
              bot_id: message.bot_id,
              app_id: message.app_id,
            }
          : undefined,
      };
    },
  });
}
