// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deletePermissionInputSchema = z.object({
  itemId: z.string().describe('The ID of the OneDrive item. Example: "01JRXCVV4F3FS3J3G7QJD2ZRK2O4I3XPGZ"'),
  permissionId: z.string().describe('The ID of the permission to delete. Example: "1"'),
});

export const deletePermissionOutputSchema = z.object({
  success: z.boolean().describe('Whether the permission was successfully deleted'),
});

export function deletePermissionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'one_drive_delete_permission',
    description: 'Remove a sharing permission from an item',
    inputSchema: deletePermissionInputSchema,
    outputSchema: deletePermissionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deletePermissionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/permission-delete
      await platformProxy.delete({
        endpoint: `/v1.0/me/drive/items/${encodeURIComponent(input.itemId)}/permissions/${encodeURIComponent(input.permissionId)}`,
        retries: 3,
      });

      return {
        success: true,
      };
    },
  });
}
