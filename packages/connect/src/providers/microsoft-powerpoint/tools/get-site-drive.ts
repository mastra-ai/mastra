// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getSiteDriveInputSchema = z.object({
  siteId: z
    .string()
    .describe(
      'SharePoint site ID. Example: "nangodevelopers.sharepoint.com,4c97403e-1663-4673-90fa-d2f8690b4510,29d15734-3d19-43f6-976b-43ece3ff81a8"',
    ),
});

const ProviderDriveSchema = z.object({
  id: z.string(),
  name: z.string(),
  driveType: z.string(),
  webUrl: z.string(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
});

export const getSiteDriveOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  driveType: z.string(),
  webUrl: z.string(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
});

export function getSiteDriveTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_powerpoint_get_site_drive',
    description: 'Get the default document library (drive) for a SharePoint site.',
    inputSchema: getSiteDriveInputSchema,
    outputSchema: getSiteDriveOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getSiteDriveOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://learn.microsoft.com/en-us/graph/api/resources/drive
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/drive`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Drive not found for the given site ID',
          siteId: input.siteId,
        });
      }

      const drive = ProviderDriveSchema.parse(response.data);

      return {
        id: drive.id,
        name: drive.name,
        driveType: drive.driveType,
        webUrl: drive.webUrl,
        ...(drive.createdDateTime !== undefined && { createdDateTime: drive.createdDateTime }),
        ...(drive.lastModifiedDateTime !== undefined && { lastModifiedDateTime: drive.lastModifiedDateTime }),
      };
    },
  });
}
