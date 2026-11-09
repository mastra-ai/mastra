// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listChannelTabsInputSchema = z.object({
  teamId: z.string().describe('The ID of the team. Example: "6903fa93-605b-43ef-920e-77c4729f8258"'),
  channelId: z.string().describe('The ID of the channel. Example: "19:33b76eea88574bd1969dca37e2b7a819@thread.skype"'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor from the previous response (@odata.nextLink). Omit for the first page.'),
});

const ConfigurationSchema = z
  .object({
    entityId: z.string().nullable().optional(),
    contentUrl: z.string().nullable().optional(),
    websiteUrl: z.string().nullable().optional(),
    removeUrl: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

const TeamsAppSchema = z
  .object({
    id: z.string(),
    displayName: z.string().optional(),
    distributionMethod: z.string().optional(),
  })
  .optional();

const ProviderTabSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  configuration: ConfigurationSchema,
  sortOrderIndex: z.string().optional(),
  teamsApp: TeamsAppSchema,
  webUrl: z.string().optional(),
});

const ProviderResponseSchema = z.object({
  value: z.array(ProviderTabSchema),
  '@odata.nextLink': z.string().optional(),
});

const TabSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  configuration: ConfigurationSchema,
  sortOrderIndex: z.string().optional(),
  teamsApp: TeamsAppSchema,
  webUrl: z.string().optional(),
});

export const listChannelTabsOutputSchema = z.object({
  items: z.array(TabSchema),
  nextCursor: z.string().optional(),
});

export function listChannelTabsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_teams_list_channel_tabs',
    description: 'List tabs configured on a channel.',
    inputSchema: listChannelTabsInputSchema,
    outputSchema: listChannelTabsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listChannelTabsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/channel-list-tabs
      const response = await platformProxy.get({
        endpoint: input.cursor || `/v1.0/teams/${input.teamId}/channels/${input.channelId}/tabs`,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        items: providerResponse.value.map(tab => ({
          id: tab.id,
          ...(tab.displayName !== undefined && { displayName: tab.displayName }),
          ...(tab.configuration !== undefined && { configuration: tab.configuration }),
          ...(tab.sortOrderIndex !== undefined && { sortOrderIndex: tab.sortOrderIndex }),
          ...(tab.teamsApp !== undefined && { teamsApp: tab.teamsApp }),
          ...(tab.webUrl !== undefined && { webUrl: tab.webUrl }),
        })),
        ...(providerResponse['@odata.nextLink'] !== undefined && {
          nextCursor: providerResponse['@odata.nextLink'],
        }),
      };
    },
  });
}
