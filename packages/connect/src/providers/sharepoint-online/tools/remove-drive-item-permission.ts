// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const removeDriveItemPermissionInputSchema = z.object({
  siteId: z
    .string()
    .describe(
      'The ID of the SharePoint site. Example: "contoso.sharepoint.com,1bc25372-6eb2-4c3c-8237-809c7c4b2800,2e1554b0-6b7f-4e52-85ff-725d9f9a9c6e"',
    ),
  driveId: z
    .string()
    .describe('The ID of the drive. Example: "b!yX8juNup80KqhYTKaqNlebaaLNrjw1VNhQ0el-3iEoQAiQ9Qf7W1Q5g"'),
  itemId: z.string().describe('The ID of the drive item. Example: "01X2JKGDJW5WBDKAXEFREIJSKIQATQZ5VE"'),
  permissionId: z.string().describe('The ID of the permission to remove. Example: "1"'),
});

export const removeDriveItemPermissionOutputSchema = z.object({
  success: z.boolean(),
});

export function removeDriveItemPermissionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_remove_drive_item_permission',
    description: 'Remove a permission from a drive item.',
    inputSchema: removeDriveItemPermissionInputSchema,
    outputSchema: removeDriveItemPermissionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof removeDriveItemPermissionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/permission-delete
      await platformProxy.delete({
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/permissions/${encodeURIComponent(input.permissionId)}`,
        retries: 3,
      });

      return {
        success: true,
      };
    },
  });
}
