// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteListInputSchema = z.object({
  siteId: z
    .string()
    .describe(
      'SharePoint site ID. Example: "contoso.sharepoint.com,12345678-1234-1234-1234-123456789012,abcdef12-3456-7890-abcd-ef1234567890"',
    ),
  listId: z.string().describe('SharePoint list ID. Example: "12345678-1234-1234-1234-123456789012"'),
});

export const deleteListOutputSchema = z.object({
  siteId: z.string(),
  listId: z.string(),
});

export function deleteListTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_delete_list',
    description: 'Delete a SharePoint list.',
    inputSchema: deleteListInputSchema,
    outputSchema: deleteListOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteListOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      await platformProxy.delete({
        // https://learn.microsoft.com/graph/api/list-delete
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/lists/${encodeURIComponent(input.listId)}`,
        retries: 3,
      });

      return {
        siteId: input.siteId,
        listId: input.listId,
      };
    },
  });
}
