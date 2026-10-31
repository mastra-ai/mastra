// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteSiteColumnInputSchema = z.object({
  siteId: z
    .string()
    .describe(
      'SharePoint site ID. Example: "contoso.sharepoint.com,00000000-0000-0000-0000-000000000000,00000000-0000-0000-0000-000000000000"',
    ),
  columnId: z.string().describe('Site column ID (GUID). Example: "00000000-0000-0000-0000-000000000000"'),
});

export const deleteSiteColumnOutputSchema = z.object({
  success: z.boolean(),
});

export function deleteSiteColumnTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_delete_site_column',
    description: 'Delete a site-level column definition.',
    inputSchema: deleteSiteColumnInputSchema,
    outputSchema: deleteSiteColumnOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteSiteColumnOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/columndefinition-delete
      await platformProxy.delete({
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/columns/${encodeURIComponent(input.columnId)}`,
        retries: 3,
      });

      return {
        success: true,
      };
    },
  });
}
