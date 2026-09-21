// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listSettingsInputSchema = z
  .object({
    cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(250)
      .optional()
      .describe('Maximum number of entries returned on one result page. By default 100, never larger than 250.'),
  })
  .describe('Input for listing calendar settings');

const ProviderSettingSchema = z.object({
  kind: z.string().optional(),
  etag: z.string().optional(),
  id: z.string(),
  value: z.string().optional(),
});

const SettingSchema = z
  .object({
    kind: z.string().optional().describe('Type of the resource ("calendar#setting").'),
    etag: z.string().optional().describe('ETag of the resource.'),
    id: z.string().describe('The ID of the user setting.'),
    value: z.string().optional().describe('Value of the user setting. The format depends on the setting ID.'),
  })
  .describe('A single calendar user setting');

export const listSettingsOutputSchema = z
  .object({
    items: z.array(SettingSchema).describe('List of user settings.'),
    nextPageToken: z
      .string()
      .optional()
      .describe('Token used to access the next page of results. Omitted if no further results are available.'),
    nextSyncToken: z
      .string()
      .optional()
      .describe('Token used later to retrieve only entries that have changed since this result.'),
  })
  .describe('Output for listing calendar settings');

export function listSettingsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_list_settings',
    description: 'List calendar settings',
    inputSchema: listSettingsInputSchema,
    outputSchema: listSettingsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSettingsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://developers.google.com/workspace/calendar/api/v3/reference/settings/list
        endpoint: '/calendar/v3/users/me/settings',
        params: {
          ...(input.cursor !== undefined && { pageToken: input.cursor }),
          ...(input.maxResults !== undefined && { maxResults: String(input.maxResults) }),
        },
        retries: 3,
      });

      const ProviderResponseSchema = z.object({
        kind: z.string().optional(),
        etag: z.string().optional(),
        nextPageToken: z.string().optional(),
        nextSyncToken: z.string().optional(),
        items: z.array(ProviderSettingSchema).optional(),
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      return {
        items:
          providerData.items?.map(item => ({
            id: item.id,
            ...(item.kind != null && { kind: item.kind }),
            ...(item.etag != null && { etag: item.etag }),
            ...(item.value != null && { value: item.value }),
          })) ?? [],
        ...(providerData.nextPageToken != null && { nextPageToken: providerData.nextPageToken }),
        ...(providerData.nextSyncToken != null && { nextSyncToken: providerData.nextSyncToken }),
      };
    },
  });
}
