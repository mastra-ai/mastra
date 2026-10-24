// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const searchDriveItemsInputSchema = z.object({
  siteId: z
    .string()
    .describe(
      'The ID of the SharePoint site. Example: "contoso.sharepoint.com,12345678-1234-1234-1234-123456789012,12345678-1234-1234-1234-123456789012"',
    ),
  driveId: z.string().describe('The ID of the drive within the site. Example: "b!1234567890abcdef"'),
  query: z.string().describe('The query text used to search for items. Example: "budget"'),
  limit: z.number().optional().describe('Maximum number of items to return per page. Default: 50'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const ProviderDriveItemSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  webUrl: z.string().nullish(),
  size: z.number().nullish(),
  createdDateTime: z.string().nullish(),
  lastModifiedDateTime: z.string().nullish(),
  folder: z.object({ childCount: z.number().nullish() }).nullish(),
  file: z.object({ mimeType: z.string().nullish() }).nullish(),
  parentReference: z
    .object({ driveId: z.string().nullish(), id: z.string().nullish(), path: z.string().nullish() })
    .nullish(),
});

const ProviderSearchResponseSchema = z.object({
  value: z.array(z.unknown()),
  '@odata.nextLink': z.string().optional(),
});

const DriveItemSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  webUrl: z.string().optional(),
  size: z.number().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  folder: z.object({ childCount: z.number().nullish() }).optional(),
  file: z.object({ mimeType: z.string().nullish() }).optional(),
  parentReference: z
    .object({ driveId: z.string().nullish(), id: z.string().nullish(), path: z.string().nullish() })
    .optional(),
});

export const searchDriveItemsOutputSchema = z.object({
  items: z.array(DriveItemSchema),
  next_cursor: z.string().optional(),
});

export function searchDriveItemsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_search_drive_items',
    description: 'Search for files and folders within a site drive.',
    inputSchema: searchDriveItemsInputSchema,
    outputSchema: searchDriveItemsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchDriveItemsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const limit = input.limit ?? 50;

      const endpoint = `/v1.0/sites/${encodeURIComponent(input.siteId)}/drives/${encodeURIComponent(input.driveId)}/root/search(q='${encodeURIComponent(input.query)}')`;

      const params: Record<string, string | number> = {
        $top: limit,
      };

      if (input.cursor) {
        params['$skiptoken'] = input.cursor;
      }

      const response = await platformProxy.get({
        // https://learn.microsoft.com/graph/api/driveitem-search
        endpoint,
        params,
        retries: 3,
      });

      const providerResponse = ProviderSearchResponseSchema.parse(response.data);

      const items = providerResponse.value.map((rawItem: unknown) => {
        const providerItem = ProviderDriveItemSchema.parse(rawItem);

        return {
          id: providerItem.id,
          ...(providerItem.name !== null && providerItem.name !== undefined && { name: providerItem.name }),
          ...(providerItem.webUrl !== null && providerItem.webUrl !== undefined && { webUrl: providerItem.webUrl }),
          ...(providerItem.size !== null && providerItem.size !== undefined && { size: providerItem.size }),
          ...(providerItem.createdDateTime !== null &&
            providerItem.createdDateTime !== undefined && { createdDateTime: providerItem.createdDateTime }),
          ...(providerItem.lastModifiedDateTime !== null &&
            providerItem.lastModifiedDateTime !== undefined && {
              lastModifiedDateTime: providerItem.lastModifiedDateTime,
            }),
          ...(providerItem.folder !== null && providerItem.folder !== undefined && { folder: providerItem.folder }),
          ...(providerItem.file !== null && providerItem.file !== undefined && { file: providerItem.file }),
          ...(providerItem.parentReference !== null &&
            providerItem.parentReference !== undefined && { parentReference: providerItem.parentReference }),
        };
      });

      let next_cursor: string | undefined;
      if (providerResponse['@odata.nextLink']) {
        const nextLinkUrl = new URL(providerResponse['@odata.nextLink']);
        const skipToken = nextLinkUrl.searchParams.get('$skiptoken') || nextLinkUrl.searchParams.get('skiptoken');
        if (skipToken) {
          next_cursor = skipToken;
        }
      }

      return {
        items,
        ...(next_cursor !== undefined && { next_cursor }),
      };
    },
  });
}
