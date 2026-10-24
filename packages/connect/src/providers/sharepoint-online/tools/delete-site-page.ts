// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteSitePageInputSchema = z.object({
  siteId: z
    .string()
    .describe('SharePoint site ID. Example: "contoso.sharepoint.com,2c7126d0-5f53-4b7b-9a3e-0b5c2e7d1f3a,1"'),
  pageId: z.string().describe('SharePoint site page ID. Example: "2"'),
});

export const deleteSitePageOutputSchema = z.object({
  siteId: z.string(),
  pageId: z.string(),
  success: z.boolean(),
});

export function deleteSitePageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_delete_site_page',
    description: 'Delete a site page.',
    inputSchema: deleteSitePageInputSchema,
    outputSchema: deleteSitePageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteSitePageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.delete({
        // https://learn.microsoft.com/graph/api/sitepage-delete
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/pages/${encodeURIComponent(input.pageId)}`,
        retries: 3,
      });

      if (response.status !== 204) {
        throw new platformProxy.ActionError({
          type: 'delete_failed',
          message: `Unexpected status code ${response.status} when deleting site page.`,
          siteId: input.siteId,
          pageId: input.pageId,
        });
      }

      return {
        siteId: input.siteId,
        pageId: input.pageId,
        success: true,
      };
    },
  });
}
