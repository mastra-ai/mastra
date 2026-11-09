// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const updateChannelInputSchema = z.object({
  teamId: z.string().describe('Team ID. Example: "3b254736-3eae-4ea8-a2d3-c2af15567230"'),
  channelId: z.string().describe('Channel ID. Example: "19:Xlx3Yg8n-kzEJI9-t2-ahJx0QIOxmdKaM9SSMAVtnDE1@thread.tacv2"'),
  displayName: z.string().optional().describe('New display name for the channel.'),
  description: z.string().optional().describe('New description for the channel.'),
});

const ProviderChannelSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  webUrl: z.string().nullable().optional(),
  membershipType: z.string().nullable().optional(),
  createdDateTime: z.string().nullable().optional(),
  isArchived: z.boolean().nullable().optional(),
  isFavoriteByDefault: z.boolean().nullable().optional(),
});

export const updateChannelOutputSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  email: z.string().optional(),
  webUrl: z.string().optional(),
  membershipType: z.string().optional(),
  createdDateTime: z.string().optional(),
  isArchived: z.boolean().optional(),
  isFavoriteByDefault: z.boolean().optional(),
});

export function updateChannelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_teams_update_channel',
    description: 'Update mutable channel properties.',
    inputSchema: updateChannelInputSchema,
    outputSchema: updateChannelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateChannelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const mutableFields: { displayName?: string; description?: string } = {
        ...(input.displayName !== undefined && { displayName: input.displayName }),
        ...(input.description !== undefined && { description: input.description }),
      };

      if (Object.keys(mutableFields).length === 0) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'At least one mutable field (displayName or description) must be provided.',
        });
      }

      const config: PlatformProxyRequest = {
        // https://learn.microsoft.com/graph/api/channel-patch
        endpoint: `/v1.0/teams/${encodeURIComponent(input.teamId)}/channels/${encodeURIComponent(input.channelId)}`,
        data: mutableFields,
        retries: 1,
      };

      const patchResponse = await platformProxy.patch(config);

      let rawData: unknown = patchResponse.data;
      if (!rawData || typeof rawData !== 'object') {
        const getConfig: PlatformProxyRequest = {
          // https://learn.microsoft.com/graph/api/channel-get
          endpoint: `/v1.0/teams/${encodeURIComponent(input.teamId)}/channels/${encodeURIComponent(input.channelId)}`,
          retries: 3,
        };
        const getResponse = await platformProxy.get(getConfig);
        rawData = getResponse.data;
      }

      const providerChannel = ProviderChannelSchema.parse(rawData);

      return {
        id: providerChannel.id,
        ...(providerChannel.displayName != null && { displayName: providerChannel.displayName }),
        ...(providerChannel.description != null && { description: providerChannel.description }),
        ...(providerChannel.email != null && { email: providerChannel.email }),
        ...(providerChannel.webUrl != null && { webUrl: providerChannel.webUrl }),
        ...(providerChannel.membershipType != null && { membershipType: providerChannel.membershipType }),
        ...(providerChannel.createdDateTime != null && { createdDateTime: providerChannel.createdDateTime }),
        ...(providerChannel.isArchived != null && { isArchived: providerChannel.isArchived }),
        ...(providerChannel.isFavoriteByDefault != null && {
          isFavoriteByDefault: providerChannel.isFavoriteByDefault,
        }),
      };
    },
  });
}
