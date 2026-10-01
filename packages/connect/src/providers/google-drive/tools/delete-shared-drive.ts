// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteSharedDriveInputSchema = z.object({
  driveId: z.string().describe('The ID of the shared drive to delete. Example: "0AP4r1ZoX57FvUk9PVA"'),
});

export const deleteSharedDriveOutputSchema = z.object({
  success: z.boolean(),
  driveId: z.string(),
});

export function deleteSharedDriveTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_delete_shared_drive',
    description: 'Delete a shared drive',
    inputSchema: deleteSharedDriveInputSchema,
    outputSchema: deleteSharedDriveOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteSharedDriveOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/drive/api/reference/rest/v3/drives/delete
      await platformProxy.delete({
        endpoint: `/drive/v3/drives/${input.driveId}`,
        retries: 3,
      });

      return {
        success: true,
        driveId: input.driveId,
      };
    },
  });
}
