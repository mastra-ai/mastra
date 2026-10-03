// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteFileInputSchema = z.object({
  fileId: z.string().describe('The ID of the file or folder to delete. Example: "1aBcDeFgHiJkLmNoPqRsTuVwXyZ123456"'),
});

export const deleteFileOutputSchema = z.object({
  success: z.boolean().describe('Whether the file was successfully deleted'),
  fileId: z.string().describe('The ID of the deleted file'),
});

export function deleteFileTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_delete_file',
    description: 'Delete a file or folder from Google Drive',
    inputSchema: deleteFileInputSchema,
    outputSchema: deleteFileOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteFileOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/drive/api/reference/rest/v3/files/delete
      await platformProxy.delete({
        endpoint: `/drive/v3/files/${input.fileId}`,
        retries: 3,
      });

      return {
        success: true,
        fileId: input.fileId,
      };
    },
  });
}
