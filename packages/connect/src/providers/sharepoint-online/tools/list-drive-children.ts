// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listDriveChildrenInputSchema = z.object({
  siteId: z.string().describe('SharePoint site ID. Example: "contoso.sharepoint.com,12345,67890"'),
  driveId: z.string().describe('Drive ID. Example: "b!abc123"'),
  itemId: z
    .string()
    .optional()
    .describe('Drive item ID of the folder. Omit to list root children. Example: "0127NLFRHGEUS6RLKWZVGZQZCMF3DVTGWG"'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor from the previous response (@odata.nextLink). Omit for the first page.'),
});

const DriveItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  webUrl: z.string().optional(),
  size: z.number().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  file: z.object({}).passthrough().optional(),
  folder: z.object({}).passthrough().optional(),
  parentReference: z.object({}).passthrough().optional(),
});

export const listDriveChildrenOutputSchema = z.object({
  items: z.array(DriveItemSchema),
  nextLink: z.string().optional().describe('URL for the next page of results. Absent when there are no more pages.'),
});

export function listDriveChildrenTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_list_drive_children',
    description: 'List items under a folder in a site drive.',
    inputSchema: listDriveChildrenInputSchema,
    outputSchema: listDriveChildrenOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listDriveChildrenOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      let endpoint: string;
      const params: Record<string, string> = {};

      if (input.cursor && input.cursor.startsWith('https://')) {
        const url = new URL(input.cursor);
        const pathParts = url.pathname.split('/v1.0/');
        if (pathParts.length !== 2 || !pathParts[1]) {
          throw new platformProxy.ActionError({
            type: 'invalid_cursor',
            message: 'Could not parse cursor URL',
          });
        }
        endpoint = `/v1.0/${pathParts[1]}`;
        url.searchParams.forEach((value, key) => {
          params[key] = value;
        });
      } else {
        endpoint = input.itemId
          ? `/v1.0/sites/${encodeURIComponent(input.siteId)}/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/children`
          : `/v1.0/sites/${encodeURIComponent(input.siteId)}/drives/${encodeURIComponent(input.driveId)}/root/children`;

        if (input.cursor) {
          params['$skiptoken'] = input.cursor;
        }
      }

      const response = await platformProxy.get({
        // https://learn.microsoft.com/graph/api/driveitem-list-children
        endpoint,
        params,
        retries: 3,
      });

      const listResponse = z
        .object({
          value: z.array(z.unknown()),
          '@odata.nextLink': z.string().optional(),
        })
        .parse(response.data);

      const items = listResponse.value.map((item: unknown) => {
        return DriveItemSchema.parse(item);
      });

      const nextLink = listResponse['@odata.nextLink'];

      return {
        items,
        ...(nextLink != null && { nextLink }),
      };
    },
  });
}
