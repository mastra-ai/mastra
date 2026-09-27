// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const archiveChannelInputSchema = z.object({
  channel_id: z.string().describe('The ID of the channel to archive. Example: "C1234567890"'),
});

export const archiveChannelOutputSchema = z.object({
  ok: z.boolean().describe('Whether the request was successful'),
  error: z.string().optional().describe('Error message if the request failed'),
});

export function archiveChannelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_archive_channel',
    description: 'Archive a Slack channel',
    inputSchema: archiveChannelInputSchema,
    outputSchema: archiveChannelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof archiveChannelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://api.slack.com/methods/conversations.archive
        endpoint: 'conversations.archive',
        data: {
          channel: input.channel_id,
        },
        retries: 3,
      });

      return {
        ok: response.data.ok,
        error: response.data.error,
      };
    },
  });
}
