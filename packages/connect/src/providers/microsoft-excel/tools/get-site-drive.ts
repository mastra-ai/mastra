// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getSiteDriveInputSchema = z.object({
  siteId: z
    .string()
    .describe(
      'The unique identifier for the SharePoint site. Example: "nangodevelopers.sharepoint.com,4c97403e-1663-4673-90fa-d2f8690b4510,29d15734-3d19-43f6-976b-43ece3ff81a8"',
    ),
});

const ProviderDriveSchema = z
  .object({
    id: z.string(),
    name: z.string().nullable().optional(),
    driveType: z.string().nullable().optional(),
    webUrl: z.string().nullable().optional(),
    createdDateTime: z.string().nullable().optional(),
    lastModifiedDateTime: z.string().nullable().optional(),
  })
  .passthrough();

export const getSiteDriveOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  driveType: z.string().optional(),
  webUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
});

export function getSiteDriveTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_get_site_drive',
    description: 'Get the default document library (drive) for a SharePoint site.',
    inputSchema: getSiteDriveInputSchema,
    outputSchema: getSiteDriveOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getSiteDriveOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://learn.microsoft.com/en-us/graph/api/site-get-drive
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/drive`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Site drive not found',
          siteId: input.siteId,
        });
      }

      const providerDrive = ProviderDriveSchema.parse(response.data);

      return {
        id: providerDrive.id,
        ...(providerDrive.name != null && { name: providerDrive.name }),
        ...(providerDrive.driveType != null && { driveType: providerDrive.driveType }),
        ...(providerDrive.webUrl != null && { webUrl: providerDrive.webUrl }),
        ...(providerDrive.createdDateTime != null && { createdDateTime: providerDrive.createdDateTime }),
        ...(providerDrive.lastModifiedDateTime != null && { lastModifiedDateTime: providerDrive.lastModifiedDateTime }),
      };
    },
  });
}
