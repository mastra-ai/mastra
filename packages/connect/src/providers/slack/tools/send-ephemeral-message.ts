// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const sendEphemeralMessageInputSchema = z.object({
  channel_id: z.string().describe('Channel ID to send the ephemeral message to. Example: "C1234567890"'),
  user_id: z
    .string()
    .describe(
      'User ID to send the ephemeral message to. The user must be in the specified channel. Example: "U1234567890"',
    ),
  text: z.string().describe('Text of the message to send. Supports Slack formatting.'),
  thread_ts: z
    .string()
    .optional()
    .describe('Thread timestamp to reply to a specific thread. Example: "1234567890.123456"'),
});

export const sendEphemeralMessageOutputSchema = z.object({
  ok: z.boolean(),
  message_ts: z.string(),
  error: z.string().optional(),
});

export function sendEphemeralMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_send_ephemeral_message',
    description: 'Send a message visible only to one user in a channel',
    inputSchema: sendEphemeralMessageInputSchema,
    outputSchema: sendEphemeralMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof sendEphemeralMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.slack.dev/reference/methods/chat.postEphemeral/
        endpoint: 'chat.postEphemeral',
        data: {
          channel: input.channel_id,
          user: input.user_id,
          text: input.text,
          ...(input.thread_ts && { thread_ts: input.thread_ts }),
        },
        retries: 3,
      });

      if (!response.data.ok) {
        throw new platformProxy.ActionError({
          type: 'slack_error',
          message: response.data.error || 'Failed to send ephemeral message',
          error: response.data.error,
        });
      }

      return {
        ok: response.data.ok,
        message_ts: response.data.message_ts,
        error: response.data.error,
      };
    },
  });
}
