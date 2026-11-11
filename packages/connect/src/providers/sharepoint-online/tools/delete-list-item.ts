// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteListItemInputSchema = z.object({
  siteId: z
    .string()
    .describe(
      'SharePoint site ID. Example: "contoso.sharepoint.com,12345678-1234-1234-1234-123456789012,98765432-1234-1234-1234-123456789012"',
    ),
  listId: z.string().describe('SharePoint list ID. Example: "12345678-1234-1234-1234-123456789012"'),
  itemId: z.string().describe('SharePoint list item ID. Example: "1"'),
});

export const deleteListItemOutputSchema = z.object({
  success: z.boolean(),
});

export function deleteListItemTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_delete_list_item',
    description: 'Delete an item from a SharePoint list.',
    inputSchema: deleteListItemInputSchema,
    outputSchema: deleteListItemOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteListItemOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/listitem-delete
      await platformProxy.delete({
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/lists/${encodeURIComponent(input.listId)}/items/${encodeURIComponent(input.itemId)}`,
        retries: 3,
      });

      return {
        success: true,
      };
    },
  });
}
