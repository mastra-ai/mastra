// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteListColumnInputSchema = z.object({
  siteId: z
    .string()
    .describe(
      'SharePoint site ID. Example: "contoso.sharepoint.com,12345678-1234-1234-1234-123456789012,abcdef12-3456-7890-abcd-ef1234567890"',
    ),
  listId: z.string().describe('SharePoint list ID. Example: "12345678-1234-1234-1234-123456789012"'),
  columnId: z.string().describe('SharePoint column definition ID. Example: "12345678-1234-1234-1234-123456789012"'),
});

export const deleteListColumnOutputSchema = z.object({
  success: z.boolean(),
});

export function deleteListColumnTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_delete_list_column',
    description: 'Delete a column from a SharePoint list.',
    inputSchema: deleteListColumnInputSchema,
    outputSchema: deleteListColumnOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteListColumnOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/columndefinition-delete
      await platformProxy.delete({
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/lists/${encodeURIComponent(input.listId)}/columns/${encodeURIComponent(input.columnId)}`,
        retries: 3,
      });

      return {
        success: true,
      };
    },
  });
}
