// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const uploadDriveItemInputSchema = z.object({
  siteId: z.string().describe('SharePoint site ID. Example: "contoso.sharepoint.com,1d2f3g4h,5i6j7k8l"'),
  driveId: z.string().describe('Drive ID. Example: "b!abc123def456"'),
  parentItemId: z.string().describe('Parent item ID. Example: "01ABC123DEF456"'),
  fileName: z.string().describe('Name of the file to upload. Example: "report.txt"'),
  content: z.string().describe('File content encoded as base64'),
  contentType: z.string().optional().describe('Content-Type of the file. Defaults to application/octet-stream'),
});

const ProviderDriveItemSchema = z.object({
  id: z.string(),
  name: z.string().optional().nullable(),
  size: z.number().optional().nullable(),
  webUrl: z.string().optional().nullable(),
  createdDateTime: z.string().optional().nullable(),
  lastModifiedDateTime: z.string().optional().nullable(),
});

export const uploadDriveItemOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  size: z.number().optional(),
  webUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
});

export function uploadDriveItemTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_upload_drive_item',
    description:
      'Upload small file content directly to a site drive (≤4 MB). For larger files use create-drive-upload-session.',
    inputSchema: uploadDriveItemInputSchema,
    outputSchema: uploadDriveItemOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof uploadDriveItemOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const decodedContent = Buffer.from(input.content, 'base64');

      const config = {
        // https://learn.microsoft.com/graph/api/driveitem-put-content
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.parentItemId)}:/${encodeURIComponent(input.fileName)}:/content`,
        headers: {
          'Content-Type': input.contentType || 'application/octet-stream',
        },
        data: decodedContent,
        retries: 3,
      };

      const response = await platformProxy.put(config);

      const providerItem = ProviderDriveItemSchema.parse(response.data);

      return {
        id: providerItem.id,
        ...(providerItem.name != null && { name: providerItem.name }),
        ...(providerItem.size != null && { size: providerItem.size }),
        ...(providerItem.webUrl != null && { webUrl: providerItem.webUrl }),
        ...(providerItem.createdDateTime != null && { createdDateTime: providerItem.createdDateTime }),
        ...(providerItem.lastModifiedDateTime != null && { lastModifiedDateTime: providerItem.lastModifiedDateTime }),
      };
    },
  });
}
