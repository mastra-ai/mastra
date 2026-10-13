// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const setChannelPurposeInputSchema = z.object({
  channel_id: z.string().describe('Channel ID to set the purpose for. Example: "C1234567890"'),
  purpose: z.string().describe('The new purpose text for the channel.'),
});

export const setChannelPurposeOutputSchema = z.object({
  success: z.boolean().describe('Whether the purpose was successfully updated'),
  channel_id: z.string().describe('The ID of the channel that was updated'),
  purpose: z.string().describe('The new purpose that was set'),
});

export function setChannelPurposeTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_set_channel_purpose',
    description: "Update a channel's purpose text for a conversation",
    inputSchema: setChannelPurposeInputSchema,
    outputSchema: setChannelPurposeOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof setChannelPurposeOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.slack.dev/reference/methods/conversations.setPurpose/
      const response = await platformProxy.post({
        endpoint: 'conversations.setPurpose',
        data: {
          channel: input.channel_id,
          purpose: input.purpose,
        },
        retries: 3,
      });

      if (!response.data?.ok) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: response.data?.error || 'Failed to set channel purpose',
          channel_id: input.channel_id,
        });
      }

      return {
        success: true,
        channel_id: input.channel_id,
        purpose: input.purpose,
      };
    },
  });
}
