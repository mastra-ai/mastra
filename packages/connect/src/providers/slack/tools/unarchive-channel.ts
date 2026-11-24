// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const unarchiveChannelInputSchema = z.object({
  channel_id: z.string().describe('The channel ID to unarchive. Example: "C02MB5ZABA7"'),
});

export const unarchiveChannelOutputSchema = z.object({
  ok: z.boolean().describe('Whether the unarchive request was successful'),
});

export function unarchiveChannelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_unarchive_channel',
    description: 'Restore an archived conversation so members can use it again',
    inputSchema: unarchiveChannelInputSchema,
    outputSchema: unarchiveChannelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof unarchiveChannelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.slack.com/methods/conversations.unarchive
        endpoint: 'conversations.unarchive',
        data: {
          channel: input.channel_id,
        },
        retries: 3,
      };

      const response = await platformProxy.post(config);

      if (!response.data?.ok) {
        throw new platformProxy.ActionError({
          type: 'unarchive_failed',
          message: response.data?.error || 'Failed to unarchive channel',
          channel_id: input.channel_id,
        });
      }

      return {
        ok: response.data.ok,
      };
    },
  });
}
