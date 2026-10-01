// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listFilesNonUnifiedInputSchema = z.object({
  folderId: z.string().optional().describe('Folder ID to list contents. Omit for root folder.'),
  cursor: z.string().optional().describe('Pagination cursor (pageToken) from previous response. Omit for first page.'),
  limit: z.number().optional().describe('Maximum number of files to return. Default: 100.'),
  includeSharedDrives: z.boolean().optional().describe('Include items from shared drives. Default: false.'),
});

const FileSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  isFolder: z.boolean(),
  parentId: z.string().optional(),
  createdTime: z.string().optional(),
  modifiedTime: z.string().optional(),
  size: z.number().optional(),
  webViewLink: z.string().optional(),
  thumbnailLink: z.string().optional(),
});

export const listFilesNonUnifiedOutputSchema = z.object({
  files: z.array(FileSchema),
  nextPageToken: z.string().optional().describe('Cursor for next page. Omitted if no more pages.'),
  totalCount: z.number().describe('Total number of files in this page.'),
});

export function listFilesNonUnifiedTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_list_files_non_unified',
    description:
      'List immediate files and folders for a folder ID, or root when omitted, with cursor pagination and shared-drive support.',
    inputSchema: listFilesNonUnifiedInputSchema,
    outputSchema: listFilesNonUnifiedOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listFilesNonUnifiedOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Build query for listing files in the specified folder
      const parentId = input.folderId || 'root';
      const query = `'${parentId}' in parents and trashed = false`;

      const params: Record<string, string | number> = {
        q: query,
        fields: 'files(id,name,mimeType,parents,createdTime,modifiedTime,size,webViewLink,thumbnailLink),nextPageToken',
        pageSize: input.limit || 100,
      };

      if (input.cursor) {
        params['pageToken'] = input.cursor;
      }

      if (input.includeSharedDrives) {
        params['includeItemsFromAllDrives'] = 'true';
        params['supportsAllDrives'] = 'true';
      }

      // https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list
      const response = await platformProxy.get({
        endpoint: '/drive/v3/files',
        params,
        retries: 3,
      });

      const files = (response.data.files || []).map(
        (file: {
          id: string;
          name: string;
          mimeType: string;
          parents?: string[];
          createdTime?: string;
          modifiedTime?: string;
          size?: string;
          webViewLink?: string;
          thumbnailLink?: string;
        }) => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          isFolder: file.mimeType === 'application/vnd.google-apps.folder',
          parentId: file.parents?.[0] || undefined,
          createdTime: file.createdTime || undefined,
          modifiedTime: file.modifiedTime || undefined,
          size: file.size ? parseInt(file.size, 10) : undefined,
          webViewLink: file.webViewLink || undefined,
          thumbnailLink: file.thumbnailLink || undefined,
        }),
      );

      return {
        files,
        nextPageToken: response.data.nextPageToken || undefined,
        totalCount: files.length,
      };
    },
  });
}
