// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteChannelInputSchema = z.object({
  teamId: z.string().describe('The unique identifier of the team. Example: "19:1234567890abcdef@thread.tacv2"'),
  channelId: z.string().describe('The unique identifier of the channel. Example: "19:abcdef1234567890@thread.tacv2"'),
});

export const deleteChannelOutputSchema = z.object({
  success: z.boolean(),
  teamId: z.string(),
  channelId: z.string(),
});

export function deleteChannelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_teams_delete_channel',
    description: 'Delete a channel from a team',
    inputSchema: deleteChannelInputSchema,
    outputSchema: deleteChannelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteChannelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/channel-delete
      await platformProxy.delete({
        endpoint: `/v1.0/teams/${input.teamId}/channels/${input.channelId}`,
        retries: 1,
      });

      return {
        success: true,
        teamId: input.teamId,
        channelId: input.channelId,
      };
    },
  });
}
