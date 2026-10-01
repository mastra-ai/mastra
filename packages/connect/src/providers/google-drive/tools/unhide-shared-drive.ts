// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const unhideSharedDriveInputSchema = z.object({
  driveId: z.string().describe('The ID of the shared drive to unhide. Example: "0ABC123xyz"'),
});

export const unhideSharedDriveOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  hidden: z.boolean().optional(),
  createdTime: z.string().optional(),
  kind: z.string().optional(),
});

export function unhideSharedDriveTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_unhide_shared_drive',
    description: 'Restore a hidden shared drive to default view',
    inputSchema: unhideSharedDriveInputSchema,
    outputSchema: unhideSharedDriveOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof unhideSharedDriveOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/unhide
      const response = await platformProxy.post({
        endpoint: `/drive/v3/drives/${input.driveId}/unhide`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Shared drive not found or could not be unhidden',
          driveId: input.driveId,
        });
      }

      return {
        id: response.data.id,
        name: response.data.name ?? undefined,
        hidden: response.data.hidden ?? undefined,
        createdTime: response.data.createdTime ?? undefined,
        kind: response.data.kind ?? undefined,
      };
    },
  });
}
