// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const unpinMessageInputSchema = z.object({
  channel_id: z.string().describe('The channel ID to unpin the message from. Example: "C1234567890"'),
  timestamp: z.string().describe('Timestamp of the message to unpin. Example: "1234567890.123456"'),
});

export const unpinMessageOutputSchema = z.object({
  ok: z.boolean().describe('Whether the request was successful'),
  error: z.string().optional().describe('Error message if the request failed'),
});

export function unpinMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_unpin_message',
    description: 'Remove a pinned message from a channel',
    inputSchema: unpinMessageInputSchema,
    outputSchema: unpinMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof unpinMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.com/methods/pins.remove
      const response = await platformProxy.post({
        endpoint: 'pins.remove',
        data: {
          channel: input.channel_id,
          timestamp: input.timestamp,
        },
        retries: 3,
      });

      return {
        ok: response.data.ok ?? true,
        error: response.data.error ?? undefined,
      };
    },
  });
}
