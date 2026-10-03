// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deletePermissionInputSchema = z.object({
  fileId: z
    .string()
    .describe('The ID of the file to delete the permission from. Example: "1xJTXyJ1Pm1rK3Y9J1Y9J1Y9J1Y9J1Y9J"'),
  permissionId: z.string().describe('The ID of the permission to delete. Example: "12345678901234567890"'),
});

export const deletePermissionOutputSchema = z.object({
  success: z.boolean(),
  fileId: z.string(),
  permissionId: z.string(),
});

export function deletePermissionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_delete_permission',
    description: 'Remove a permission from a file',
    inputSchema: deletePermissionInputSchema,
    outputSchema: deletePermissionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deletePermissionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/delete
      await platformProxy.delete({
        endpoint: `drive/v3/files/${input.fileId}/permissions/${input.permissionId}`,
        retries: 3,
      });

      return {
        success: true,
        fileId: input.fileId,
        permissionId: input.permissionId,
      };
    },
  });
}
