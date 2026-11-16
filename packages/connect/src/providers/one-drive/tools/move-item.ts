// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const moveItemInputSchema = z.object({
  itemId: z.string().describe('The ID of the drive item to move or rename. Example: "0123456789abc"'),
  parentFolderId: z
    .string()
    .optional()
    .describe('The ID of the destination folder to move the item to. If omitted, the item stays in the same location.'),
  name: z.string().optional().describe('The new name for the item. If omitted, the item keeps its current name.'),
});

const ParentReferenceSchema = z.object({
  id: z.string().optional(),
});

const ProviderDriveItemSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  parentReference: ParentReferenceSchema.optional(),
});

export const moveItemOutputSchema = z.object({
  id: z.string().describe('The ID of the moved/renamed item'),
  name: z.string().describe('The name of the item'),
  parentFolderId: z.string().optional().describe('The ID of the parent folder'),
});

export function moveItemTool(proxy: PlatformProxy) {
  return createTool({
    id: 'one_drive_move_item',
    description: 'Move or rename a file or folder',
    inputSchema: moveItemInputSchema,
    outputSchema: moveItemOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof moveItemOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const body: { parentReference?: { id: string }; name?: string } = {};

      if (input.parentFolderId !== undefined) {
        body.parentReference = {
          id: input.parentFolderId,
        };
      }

      if (input.name !== undefined) {
        body.name = input.name;
      }

      const response = await platformProxy.patch({
        // https://learn.microsoft.com/graph/api/driveitem-update
        endpoint: `/v1.0/me/drive/items/${encodeURIComponent(input.itemId)}`,
        data: body,
        retries: 3,
      });

      const item = ProviderDriveItemSchema.parse(response.data);

      return {
        id: item.id,
        name: item.name || '',
        ...(item.parentReference?.id && { parentFolderId: item.parentReference.id }),
      };
    },
  });
}
