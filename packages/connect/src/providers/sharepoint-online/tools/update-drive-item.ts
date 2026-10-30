// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateDriveItemInputSchema = z.object({
  siteId: z
    .string()
    .describe(
      'SharePoint site ID. Example: "nangodevelopers.sharepoint.com,ff9cef8d-d0e4-4638-a6a6-d5374e2b31e1,d12a8199-c77a-4e48-a193-2e1288b26f13"',
    ),
  driveId: z
    .string()
    .describe('Drive ID. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"'),
  itemId: z.string().describe('Drive item ID. Example: "01RFYLAYF2MHKA54O4TZDL5SKCE4MJLIUJ"'),
  name: z.string().optional().describe('New name for the drive item.'),
  parentReference: z
    .object({
      id: z.string().optional().describe('ID of the target parent folder to move the item into.'),
    })
    .optional()
    .describe('Parent reference for moving the item.'),
});

export const updateDriveItemOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  webUrl: z.string().optional(),
  size: z.number().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  parentReference: z
    .object({
      id: z.string().optional(),
      driveId: z.string().optional(),
      path: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
  file: z.object({}).passthrough().optional(),
  folder: z.object({}).passthrough().optional(),
});

export function updateDriveItemTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_update_drive_item',
    description: 'Rename or move a file or folder in a site drive.',
    inputSchema: updateDriveItemInputSchema,
    outputSchema: updateDriveItemOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateDriveItemOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const data: { name?: string; parentReference?: { id?: string } } = {};

      if (input.name !== undefined) {
        data.name = input.name;
      }

      if (input.parentReference !== undefined) {
        const parentRef: { id?: string } = {};
        if (input.parentReference.id !== undefined) {
          parentRef.id = input.parentReference.id;
        }
        if (Object.keys(parentRef).length > 0) {
          data.parentReference = parentRef;
        }
      }

      if (Object.keys(data).length === 0) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'At least one of name or parentReference must be provided.',
        });
      }

      const response = await platformProxy.patch({
        // https://learn.microsoft.com/graph/api/driveitem-update
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}`,
        data,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Drive item not found or update failed.',
        });
      }

      return updateDriveItemOutputSchema.parse(response.data);
    },
  });
}
