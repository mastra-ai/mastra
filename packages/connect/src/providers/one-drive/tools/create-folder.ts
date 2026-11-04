// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createFolderInputSchema = z.object({
  parentItemId: z
    .string()
    .describe('The ID of the parent item where the folder will be created. Use "root" to create in the root.'),
  name: z.string().describe('The name of the new folder.'),
  conflictBehavior: z.enum(['fail', 'replace', 'rename']).optional().describe('The conflict resolution behavior.'),
});

const FolderSchema = z.object({
  childCount: z.number().optional(),
});

const ProviderDriveItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  folder: FolderSchema.optional(),
  createdDateTime: z.string().optional(),
  webUrl: z.string().optional(),
  size: z.number().optional(),
  parentReference: z
    .object({
      driveId: z.string().optional(),
      id: z.string().optional(),
      path: z.string().optional(),
    })
    .optional(),
});

export const createFolderOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  webUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  parentReference: z
    .object({
      driveId: z.string().optional(),
      id: z.string().optional(),
      path: z.string().optional(),
    })
    .optional(),
});

export function createFolderTool(proxy: PlatformProxy) {
  return createTool({
    id: 'one_drive_create_folder',
    description: 'Create a folder in OneDrive.',
    inputSchema: createFolderInputSchema,
    outputSchema: createFolderOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createFolderOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/driveitem-post-children
      const response = await platformProxy.post({
        endpoint: `/v1.0/me/drive/items/${encodeURIComponent(input.parentItemId)}/children`,
        data: {
          name: input.name,
          folder: {},
          '@microsoft.graph.conflictBehavior': input.conflictBehavior ?? 'rename',
        },
        retries: 3,
      });

      if (response.status !== 201) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: `Unexpected status code: ${response.status}`,
          status: response.status,
        });
      }

      const driveItem = ProviderDriveItemSchema.parse(response.data);

      return {
        id: driveItem.id,
        name: driveItem.name,
        ...(driveItem.webUrl !== undefined && { webUrl: driveItem.webUrl }),
        ...(driveItem.createdDateTime !== undefined && { createdDateTime: driveItem.createdDateTime }),
        ...(driveItem.parentReference !== undefined && { parentReference: driveItem.parentReference }),
      };
    },
  });
}
