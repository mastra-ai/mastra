// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const pinMessageInputSchema = z.object({
  channel_id: z.string().describe('Channel ID where the message was posted. Example: "C1234567890"'),
  message_timestamp: z.string().describe('Timestamp of the message to pin. Example: "1355517523.000005"'),
});

export const pinMessageOutputSchema = z.object({
  ok: z.boolean().describe('Whether the pin was successfully added'),
});

export function pinMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_pin_message',
    description: 'Pin a specific message in a channel',
    inputSchema: pinMessageInputSchema,
    outputSchema: pinMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof pinMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.slack.dev/reference/methods/pins.add/
        endpoint: 'pins.add',
        data: {
          channel: input.channel_id,
          timestamp: input.message_timestamp,
        },
        retries: 3,
      });

      if (!response.data.ok) {
        throw new platformProxy.ActionError({
          type: 'slack_error',
          message: response.data.error || 'Failed to pin message',
          slack_error: response.data.error,
        });
      }

      return {
        ok: response.data.ok,
      };
    },
  });
}
