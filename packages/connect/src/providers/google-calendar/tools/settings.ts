// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const settingsInputSchema = z.object({}).describe('No input required');

const SettingSchema = z
  .object({
    id: z.string().describe('The id of the user setting. Example: "timezone"'),
    value: z.string().describe('Value of the user setting. The format depends on the setting ID.'),
    kind: z.string().optional().describe('Type of the resource. Example: "calendar#setting"'),
    etag: z.string().optional().describe('ETag of the resource.'),
  })
  .describe('A single user setting');

export const settingsOutputSchema = z
  .object({
    items: z.array(SettingSchema).describe('All user settings fetched across pages.'),
  })
  .describe('All user settings for the authenticated user');

const ProviderSettingsSchema = z.object({
  kind: z.string().optional(),
  etag: z.string().optional(),
  nextPageToken: z.string().optional(),
  nextSyncToken: z.string().optional(),
  items: z
    .array(
      z.object({
        kind: z.string().optional(),
        etag: z.string().optional(),
        id: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
});

export function settingsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_settings',
    description: 'Fetch all user settings across pages from Google Calendar',
    inputSchema: settingsInputSchema,
    outputSchema: settingsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof settingsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const allItems: Array<{ id: string; value: string; kind?: string; etag?: string }> = [];
      let pageToken: string | undefined;

      do {
        const config: PlatformProxyRequest = {
          // https://developers.google.com/workspace/calendar/api/v3/reference/settings/list
          endpoint: '/calendar/v3/users/me/settings',
          params: {
            ...(pageToken !== undefined && { pageToken }),
          },
          retries: 3,
        };

        const response = await platformProxy.get(config);
        const parsed = ProviderSettingsSchema.parse(response.data);

        if (parsed.items) {
          for (const item of parsed.items) {
            allItems.push({
              id: item.id,
              value: item.value,
              ...(item.kind !== undefined && { kind: item.kind }),
              ...(item.etag !== undefined && { etag: item.etag }),
            });
          }
        }

        pageToken = parsed.nextPageToken;
      } while (pageToken);

      return {
        items: allItems,
      };
    },
  });
}
