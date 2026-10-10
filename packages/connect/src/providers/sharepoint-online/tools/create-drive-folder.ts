// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createDriveFolderInputSchema = z.object({
  siteId: z.string().describe('SharePoint site ID. Example: "contoso.sharepoint.com,site-id,web-id"'),
  driveId: z.string().describe('Drive (document library) ID. Example: "b!1234567890abcdef"'),
  parentItemId: z.string().describe('Parent item ID where the folder will be created. Example: "0123456789abcdef"'),
  name: z.string().describe('Name of the new folder. Example: "New Folder"'),
  conflictBehavior: z
    .enum(['rename', 'fail', 'replace'])
    .optional()
    .describe('Conflict behavior if a folder with the same name exists. Defaults to "rename".'),
});

export const createDriveFolderOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  webUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  size: z.number().optional(),
  parentReference: z
    .object({
      driveId: z.string().optional(),
      id: z.string().optional(),
      path: z.string().optional(),
    })
    .optional(),
  folder: z
    .object({
      childCount: z.number().optional(),
    })
    .optional(),
});

export function createDriveFolderTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_create_drive_folder',
    description: 'Create a folder in a SharePoint document library.',
    inputSchema: createDriveFolderInputSchema,
    outputSchema: createDriveFolderOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createDriveFolderOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/driveitem-post-children
      const response = await platformProxy.post({
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.parentItemId)}/children`,
        data: {
          name: input.name,
          folder: {},
          '@microsoft.graph.conflictBehavior': input.conflictBehavior ?? 'rename',
        },
        retries: 3,
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'Invalid response from Microsoft Graph API',
        });
      }

      return createDriveFolderOutputSchema.parse(response.data);
    },
  });
}
