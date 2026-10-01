// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const findFolderInputSchema = z.object({
  name: z.string().describe('Folder name or search query to find folders by name. Example: "Test Folder Alpha"'),
});

const FolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdTime: z.string().optional(),
});

export const findFolderOutputSchema = z.object({
  folders: z.array(FolderSchema),
  totalCount: z.number(),
});

export function findFolderTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_find_folder',
    description: 'Search for a folder by name or query',
    inputSchema: findFolderInputSchema,
    outputSchema: findFolderOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof findFolderOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/drive/api/reference/rest/v3/files/list
      const response = await platformProxy.get({
        endpoint: '/drive/v3/files',
        params: {
          q: `mimeType='application/vnd.google-apps.folder' and name contains '${input.name}' and trashed=false`,
          fields: 'files(id,name,createdTime)',
          spaces: 'drive',
          pageSize: 100,
        },
        retries: 3,
      });

      const files = response.data?.files || [];

      const folders = files.map((file: { id: string; name: string; createdTime?: string }) => ({
        id: file.id,
        name: file.name,
        createdTime: file.createdTime ?? undefined,
      }));

      return {
        folders,
        totalCount: folders.length,
      };
    },
  });
}
