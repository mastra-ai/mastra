// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const downloadDriveItemContentInputSchema = z.object({
  siteId: z.string().describe('SharePoint site ID. Example: "contoso.sharepoint.com,site-id"'),
  driveId: z.string().describe('Drive ID. Example: "drive-id"'),
  itemId: z.string().describe('Drive item ID. Example: "item-id"'),
});

export const downloadDriveItemContentOutputSchema = z.object({
  content: z.string().describe('Base64-encoded file content'),
  size: z.number().describe('File size in bytes'),
  mimeType: z.string().optional().describe('MIME type of the file'),
});

export function downloadDriveItemContentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_download_drive_item_content',
    description: 'Download the file content of a SharePoint drive item',
    inputSchema: downloadDriveItemContentInputSchema,
    outputSchema: downloadDriveItemContentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof downloadDriveItemContentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://learn.microsoft.com/graph/api/driveitem-get-content
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/content`,
        retries: 3,
        responseType: 'arraybuffer',
      });

      if (response.status === 404) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Drive item not found',
          siteId: input.siteId,
          driveId: input.driveId,
          itemId: input.itemId,
        });
      }

      const buffer = Buffer.from(response.data);
      const content = buffer.toString('base64');
      const mimeType = response.headers['content-type'];

      return {
        content,
        size: buffer.length,
        ...(typeof mimeType === 'string' && mimeType.length > 0 && { mimeType }),
      };
    },
  });
}
