// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const hideSharedDriveInputSchema = z.object({
  driveId: z.string().describe('The ID of the shared drive to hide. Example: "0ABC123xyz"'),
});

export const hideSharedDriveOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  hidden: z.boolean(),
});

export function hideSharedDriveTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_hide_shared_drive',
    description: 'Hide a shared drive from the default view',
    inputSchema: hideSharedDriveInputSchema,
    outputSchema: hideSharedDriveOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof hideSharedDriveOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/hide
      const response = await platformProxy.post({
        endpoint: `/drive/v3/drives/${input.driveId}/hide`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Shared drive not found',
          driveId: input.driveId,
        });
      }

      return {
        id: response.data.id,
        name: response.data.name ?? undefined,
        hidden: response.data.hidden ?? true,
      };
    },
  });
}
