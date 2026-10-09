// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createChannelTabInputSchema = z.object({
  teamId: z.string().describe('Team ID. Example: "02bd9fd6-8f93-4758-87c3-1fb73740a315"'),
  channelId: z.string().describe('Channel ID. Example: "19:4b6bedd7427d44f6b46b1bf92ab9f5f2@thread.tacv2"'),
  displayName: z.string().describe('Display name for the tab. Example: "My Tab"'),
  teamsAppOdataBind: z
    .string()
    .describe(
      'OData bind reference to the Teams app. Example: "https://graph.microsoft.com/v1.0/appCatalogs/teamsApps/com.microsoft.teamspace.tab.web"',
    ),
  configuration: z
    .object({
      entityId: z.string().optional().describe('Entity ID for the tab content'),
      contentUrl: z.string().describe('Content URL for the tab. Example: "https://www.example.com/content"'),
      removeUrl: z.string().optional().describe('Remove URL for the tab'),
      websiteUrl: z.string().optional().describe('Website URL for the tab. Example: "https://www.example.com"'),
    })
    .describe('Configuration properties for the tab'),
});

const ProviderTabSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  teamsApp: z
    .object({
      id: z.string(),
      displayName: z.string().optional(),
      distributionMethod: z.string().optional(),
    })
    .optional(),
  configuration: z
    .object({
      entityId: z.string().nullable().optional(),
      contentUrl: z.string().nullable().optional(),
      removeUrl: z.string().nullable().optional(),
      websiteUrl: z.string().nullable().optional(),
    })
    .optional(),
  sortOrderIndex: z.string().optional(),
  webUrl: z.string().optional(),
});

export const createChannelTabOutputSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  teamsAppId: z.string().optional(),
  teamsAppName: z.string().optional(),
  configuration: z
    .object({
      entityId: z.string().optional(),
      contentUrl: z.string().optional(),
      removeUrl: z.string().optional(),
      websiteUrl: z.string().optional(),
    })
    .optional(),
  sortOrderIndex: z.string().optional(),
  webUrl: z.string().optional(),
});

export function createChannelTabTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_teams_create_channel_tab',
    description: 'Add a tab to a channel.',
    inputSchema: createChannelTabInputSchema,
    outputSchema: createChannelTabOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createChannelTabOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/channel-post-tabs
      const response = await platformProxy.post({
        endpoint: `/v1.0/teams/${input.teamId}/channels/${input.channelId}/tabs`,
        data: {
          displayName: input.displayName,
          'teamsApp@odata.bind': input.teamsAppOdataBind,
          configuration: input.configuration,
        },
        retries: 3,
      });

      const providerTab = ProviderTabSchema.parse(response.data);

      return {
        id: providerTab.id,
        displayName: providerTab.displayName,
        ...(providerTab.teamsApp?.id && { teamsAppId: providerTab.teamsApp.id }),
        ...(providerTab.teamsApp?.displayName && { teamsAppName: providerTab.teamsApp.displayName }),
        ...(providerTab.configuration && {
          configuration: {
            ...(providerTab.configuration.entityId != null && { entityId: providerTab.configuration.entityId }),
            ...(providerTab.configuration.contentUrl != null && { contentUrl: providerTab.configuration.contentUrl }),
            ...(providerTab.configuration.removeUrl != null && { removeUrl: providerTab.configuration.removeUrl }),
            ...(providerTab.configuration.websiteUrl != null && { websiteUrl: providerTab.configuration.websiteUrl }),
          },
        }),
        ...(providerTab.sortOrderIndex && { sortOrderIndex: providerTab.sortOrderIndex }),
        ...(providerTab.webUrl && { webUrl: providerTab.webUrl }),
      };
    },
  });
}
