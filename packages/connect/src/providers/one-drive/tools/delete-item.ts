// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteItemInputSchema = z.object({
  itemId: z.string().describe('The ID of the item (file or folder) to delete. Example: "0123456789ABC"'),
});

export const deleteItemOutputSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful'),
  itemId: z.string().describe('The ID of the deleted item'),
  message: z.string().describe('Status message'),
});

export function deleteItemTool(proxy: PlatformProxy) {
  return createTool({
    id: 'one_drive_delete_item',
    description: 'Delete a file or folder.',
    inputSchema: deleteItemInputSchema,
    outputSchema: deleteItemOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteItemOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/driveitem-delete
      await platformProxy.delete({
        endpoint: `/v1.0/me/drive/items/${encodeURIComponent(input.itemId)}`,
        retries: 3,
      });

      return {
        success: true,
        itemId: input.itemId,
        message: 'Item deleted successfully',
      };
    },
  });
}
