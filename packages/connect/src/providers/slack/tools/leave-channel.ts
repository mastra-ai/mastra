// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const leaveChannelInputSchema = z.object({
  channel_id: z.string().describe('The ID of the channel to leave. Example: "C1234567890"'),
});

export const leaveChannelOutputSchema = z.object({
  ok: z.boolean().describe('Whether the request was successful'),
  error: z.string().optional().describe('Error message if the request failed'),
});

export function leaveChannelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_leave_channel',
    description: 'Leave a channel',
    inputSchema: leaveChannelInputSchema,
    outputSchema: leaveChannelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof leaveChannelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.dev/methods/conversations.leave
      const response = await platformProxy.post({
        endpoint: 'conversations.leave',
        data: {
          channel: input.channel_id,
        },
        retries: 3,
      });

      return {
        ok: response.data.ok ?? false,
        error: response.data.error ?? undefined,
      };
    },
  });
}
