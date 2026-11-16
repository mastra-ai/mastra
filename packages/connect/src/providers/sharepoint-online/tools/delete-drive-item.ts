// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteDriveItemInputSchema = z.object({
  siteId: z
    .string()
    .describe(
      'The unique identifier of the SharePoint site. Example: "nango.sharepoint.com,1d123d45-1234-12d4-1d34-12d1234d12d1,12d12345-12d1-12d4-12d4-12d1234d12d1"',
    ),
  driveId: z
    .string()
    .describe(
      'The unique identifier of the drive. Example: "b!1d123d4512d412d412d412d1234d12d1d12d1234d12d412d1234d12d12d12d"',
    ),
  itemId: z.string().describe('The unique identifier of the drive item. Example: "0123456789ABC!123"'),
});

export const deleteDriveItemOutputSchema = z.object({
  success: z.boolean(),
});

export function deleteDriveItemTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_delete_drive_item',
    description: 'Delete a file or folder from a site drive.',
    inputSchema: deleteDriveItemInputSchema,
    outputSchema: deleteDriveItemOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteDriveItemOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/driveitem-delete
      await platformProxy.delete({
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}`,
        retries: 3,
      });

      return {
        success: true,
      };
    },
  });
}
