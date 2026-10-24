// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const publishSitePageInputSchema = z.object({
  siteId: z.string().describe('SharePoint site ID. Example: "contoso.sharepoint.com,site-id"'),
  pageId: z.string().describe('Site page ID. Example: "page-id-guid"'),
});

export const publishSitePageOutputSchema = z.object({
  success: z.boolean(),
  siteId: z.string(),
  pageId: z.string(),
});

export function publishSitePageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_publish_site_page',
    description: 'Publish a site page.',
    inputSchema: publishSitePageInputSchema,
    outputSchema: publishSitePageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof publishSitePageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const encodedSiteId = encodeURIComponent(input.siteId);
      const encodedPageId = encodeURIComponent(input.pageId);

      const config: PlatformProxyRequest = {
        // https://learn.microsoft.com/graph/api/sitepage-publish
        endpoint: `/v1.0/sites/${encodedSiteId}/pages/${encodedPageId}/microsoft.graph.sitePage/publish`,
        retries: 3,
      };

      const response = await platformProxy.post(config);

      if (response.status !== 204 && response.status !== 200) {
        throw new platformProxy.ActionError({
          type: 'publish_failed',
          message: `Page publish failed with status ${response.status}`,
          siteId: input.siteId,
          pageId: input.pageId,
        });
      }

      return {
        success: true,
        siteId: input.siteId,
        pageId: input.pageId,
      };
    },
  });
}
