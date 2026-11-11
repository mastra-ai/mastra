// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const uploadSmallFileInputSchema = z.object({
  parent_item_id: z
    .string()
    .describe('The ID of the parent folder where the file will be uploaded. Example: "0123456789ABCDEF!1234"'),
  file_name: z.string().describe('The name of the file to create. Example: "document.txt"'),
  content: z.string().describe('The binary content of the file as a base64-encoded string.'),
  content_type: z
    .string()
    .optional()
    .describe('The MIME type of the file content. Defaults to "application/octet-stream".'),
});

const ProviderDriveItemSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  size: z.number().optional(),
  webUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  '@microsoft.graph.downloadUrl': z.string().nullable().optional(),
});

export const uploadSmallFileOutputSchema = z.object({
  id: z.string().describe('The ID of the uploaded file.'),
  name: z.string().optional().describe('The name of the uploaded file.'),
  size: z.number().optional().describe('The size of the uploaded file in bytes.'),
  web_url: z.string().optional().describe('The URL to open the file in OneDrive.'),
  created_date_time: z.string().optional().describe('The UTC date and time the file was created.'),
  last_modified_date_time: z.string().optional().describe('The UTC date and time the file was last modified.'),
  download_url: z.string().optional().describe('A temporary download URL for the file content.'),
});

export function uploadSmallFileTool(proxy: PlatformProxy) {
  return createTool({
    id: 'one_drive_upload_small_file',
    description: 'Upload a small file in a single request.',
    inputSchema: uploadSmallFileInputSchema,
    outputSchema: uploadSmallFileOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof uploadSmallFileOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Decode base64 content to binary buffer
      const binaryContent = Buffer.from(input.content, 'base64');

      const response = await platformProxy.put({
        // https://learn.microsoft.com/graph/api/driveitem-put-content
        endpoint: `/v1.0/me/drive/items/${encodeURIComponent(input.parent_item_id)}:/${encodeURIComponent(input.file_name)}:/content`,
        headers: {
          'Content-Type': input.content_type || 'application/octet-stream',
        },
        data: binaryContent,
        retries: 3,
      });

      const providerItem = ProviderDriveItemSchema.parse(response.data);

      return {
        id: providerItem.id,
        ...(providerItem.name !== undefined && { name: providerItem.name }),
        ...(providerItem.size !== undefined && { size: providerItem.size }),
        ...(providerItem.webUrl !== undefined && { web_url: providerItem.webUrl }),
        ...(providerItem.createdDateTime !== undefined && {
          created_date_time: providerItem.createdDateTime,
        }),
        ...(providerItem.lastModifiedDateTime !== undefined && {
          last_modified_date_time: providerItem.lastModifiedDateTime,
        }),
        ...(providerItem['@microsoft.graph.downloadUrl'] != null && {
          download_url: providerItem['@microsoft.graph.downloadUrl'],
        }),
      };
    },
  });
}
