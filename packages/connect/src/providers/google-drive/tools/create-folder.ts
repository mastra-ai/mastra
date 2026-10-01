// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const CreateFolderResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  createdTime: z.string(),
  parents: z.array(z.string()).optional(),
});

export const createFolderInputSchema = z.object({
  name: z.string().describe('The name of the new folder. Example: "My New Folder"'),
  parentId: z
    .string()
    .optional()
    .describe(
      'The ID of the parent folder where the new folder will be created. If omitted, the folder is created in the root of the drive. Example: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"',
    ),
});

export const createFolderOutputSchema = z.object({
  id: z.string().describe('The unique identifier of the created folder.'),
  name: z.string().describe('The name of the created folder.'),
  mimeType: z.string().describe('The MIME type of the folder (always application/vnd.google-apps.folder).'),
  createdTime: z.string().describe('The timestamp when the folder was created.'),
  parentIds: z.array(z.string()).describe('Array of parent folder IDs.'),
});

export function createFolderTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_create_folder',
    description: 'Create a new folder in Google Drive',
    inputSchema: createFolderInputSchema,
    outputSchema: createFolderOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createFolderOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create
      const requestBody: Record<string, unknown> = {
        name: input.name,
        mimeType: 'application/vnd.google-apps.folder',
      };

      if (input.parentId) {
        requestBody['parents'] = [input.parentId];
      }

      const response = await platformProxy.post({
        endpoint: '/drive/v3/files',
        params: {
          fields: 'id,name,mimeType,createdTime,parents',
        },
        data: requestBody,
        retries: 3,
      });

      const file = CreateFolderResponseSchema.parse(response.data);

      return {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        createdTime: file.createdTime,
        parentIds: file.parents || [],
      };
    },
  });
}
