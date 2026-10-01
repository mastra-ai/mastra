// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const copyFileInputSchema = z.object({
  fileId: z.string().describe('The ID of the file to copy. Example: "123abc"'),
  name: z.string().optional().describe('The new name for the copied file. If not provided, the original name is used.'),
  destinationFolderId: z
    .string()
    .optional()
    .describe(
      'The ID of the folder where the copy should be placed. If not provided, the copy is placed in the same folder as the original.',
    ),
});

export const copyFileOutputSchema = z.object({
  id: z.string().describe('The ID of the copied file'),
  name: z.string().describe('The name of the copied file'),
  mimeType: z.string().describe('The MIME type of the copied file'),
  createdTime: z.string().optional().describe('The creation time of the copied file (RFC 3339)'),
});

export function copyFileTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_copy_file',
    description: 'Copy a file to a destination',
    inputSchema: copyFileInputSchema,
    outputSchema: copyFileOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof copyFileOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: { name?: string; parents?: string[] } = {};

      if (input.name) {
        requestBody.name = input.name;
      }

      if (input.destinationFolderId) {
        requestBody.parents = [input.destinationFolderId];
      }

      // https://developers.google.com/drive/api/reference/rest/v3/files/copy
      const response = await platformProxy.post({
        endpoint: `/drive/v3/files/${input.fileId}/copy`,
        data: requestBody,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'copy_failed',
          message: 'Failed to copy file',
          fileId: input.fileId,
        });
      }

      return {
        id: response.data.id,
        name: response.data.name,
        mimeType: response.data.mimeType,
        createdTime: response.data.createdTime ?? undefined,
      };
    },
  });
}
