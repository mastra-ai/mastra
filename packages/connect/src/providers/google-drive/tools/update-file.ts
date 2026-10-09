// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateFileInputSchema = z.object({
  fileId: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
  starred: z.boolean().optional(),
  trashed: z.boolean().optional(),
  parents: z.array(z.string()).optional(),
  appProperties: z.record(z.string(), z.string()).optional(),
  properties: z.record(z.string(), z.string()).optional(),
});

export const updateFileOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  description: z.string().optional(),
  starred: z.boolean(),
  trashed: z.boolean(),
  parents: z.array(z.string()),
  createdTime: z.string(),
  modifiedTime: z.string(),
  size: z.string().optional(),
  webViewLink: z.string().optional(),
});

export function updateFileTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_update_file',
    description: "Update a file's metadata",
    inputSchema: updateFileInputSchema,
    outputSchema: updateFileOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateFileOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Build the request body with only the fields that are provided
      const requestBody: Record<string, any> = {};

      if (input.name !== undefined) requestBody['name'] = input.name;
      if (input.description !== undefined) requestBody['description'] = input.description;
      if (input.mimeType !== undefined) requestBody['mimeType'] = input.mimeType;
      if (input.starred !== undefined) requestBody['starred'] = input.starred;
      if (input.trashed !== undefined) requestBody['trashed'] = input.trashed;
      if (input.parents !== undefined) requestBody['parents'] = input.parents;
      if (input.appProperties !== undefined) requestBody['appProperties'] = input.appProperties;
      if (input.properties !== undefined) requestBody['properties'] = input.properties;

      // https://developers.google.com/drive/api/reference/rest/v3/files/update
      const response = await platformProxy.patch({
        endpoint: `/drive/v3/files/${input.fileId}`,
        data: requestBody,
        params: {
          supportsAllDrives: 'true',
          fields: 'id,name,mimeType,description,starred,trashed,parents,createdTime,modifiedTime,size,webViewLink',
        },
        retries: 3,
      });

      const file = response.data;

      return {
        id: file['id'],
        name: file['name'],
        mimeType: file['mimeType'],
        description: file['description'] || undefined,
        starred: file['starred'] || false,
        trashed: file['trashed'] || false,
        parents: file['parents'] || [],
        createdTime: file['createdTime'],
        modifiedTime: file['modifiedTime'],
        size: file['size'] || undefined,
        webViewLink: file['webViewLink'] || undefined,
      };
    },
  });
}
