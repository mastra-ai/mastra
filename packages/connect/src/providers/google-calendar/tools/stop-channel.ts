// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const stopChannelInputSchema = z
  .object({
    id: z.string().describe('The channel ID returned when the channel was created. Example: "test-channel-12345"'),
    resourceId: z
      .string()
      .describe('The opaque resource ID returned when the channel was created. Example: "YbJ8bUochj7xzKeEPV5iSw7J24Q"'),
    token: z
      .string()
      .optional()
      .describe('An arbitrary token delivered to the target address with each notification. Optional.'),
  })
  .describe('Parameters required to stop an active push notification channel.');

export const stopChannelOutputSchema = z.object({
  success: z.boolean(),
});

export function stopChannelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_stop_channel',
    description: 'Stop push notifications for a channel',
    inputSchema: stopChannelInputSchema,
    outputSchema: stopChannelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof stopChannelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://developers.google.com/workspace/calendar/api/v3/reference/channels/stop
        endpoint: '/calendar/v3/channels/stop',
        data: {
          id: input.id,
          resourceId: input.resourceId,
          ...(input.token !== undefined && { token: input.token }),
        },
        retries: 3,
      };

      await platformProxy.post(config);

      return { success: true };
    },
  });
}
