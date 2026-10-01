// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const findFileInputSchema = z.object({
  query: z
    .string()
    .optional()
    .describe(
      'Search query string. Uses Google Drive search query syntax. Example: "name contains \'report\'" or "mimeType = \'application/pdf\'". If not provided, returns all files.',
    ),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor (nextPageToken) from previous response. Omit for first page.'),
  pageSize: z.number().optional().describe('Maximum number of files to return per page. Default is 100.'),
});

const FileSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  modifiedTime: z.string().optional(),
  size: z.string().optional(),
  webViewLink: z.string().optional(),
});

export const findFileOutputSchema = z.object({
  files: z.array(FileSchema),
  nextPageToken: z.string().optional().describe('Pagination cursor for the next page. Omitted if no more results.'),
  totalResults: z.number().optional().describe('Total number of files returned in this page'),
});

export function findFileTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_find_file',
    description: 'Search for files by name or query in Google Drive',
    inputSchema: findFileInputSchema,
    outputSchema: findFileOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof findFileOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list
      const params: Record<string, string | number> = {
        fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink)',
        orderBy: 'modifiedTime desc',
        pageSize: input.pageSize || 100,
      };

      if (input.query) {
        params['q'] = input.query;
      }

      if (input.cursor) {
        params['pageToken'] = input.cursor;
      }

      const response = await platformProxy.get({
        endpoint: '/drive/v3/files',
        params,
        retries: 3,
      });

      const files = (response.data.files || []).map((file: any) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        modifiedTime: file.modifiedTime,
        size: file.size,
        webViewLink: file.webViewLink,
      }));

      return {
        files,
        nextPageToken: response.data.nextPageToken || undefined,
        totalResults: files.length,
      };
    },
  });
}
