// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const searchSitesInputSchema = z.object({
  query: z.string().describe('Search keyword. Example: "contoso"'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const ProviderSiteSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  webUrl: z.string().optional(),
});

const ProviderResponseSchema = z.object({
  value: z.array(ProviderSiteSchema),
  '@odata.nextLink': z.string().optional(),
});

const OutputItemSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  webUrl: z.string().optional(),
});

export const searchSitesOutputSchema = z.object({
  items: z.array(OutputItemSchema),
  next_cursor: z.string().optional(),
});

export function searchSitesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_search_sites',
    description: 'Search for sites by keyword.',
    inputSchema: searchSitesInputSchema,
    outputSchema: searchSitesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchSitesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/site-search
      const response = await platformProxy.get({
        endpoint: '/v1.0/sites',
        params: {
          search: input.query,
          ...(input.cursor !== undefined && { $skiptoken: input.cursor }),
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      const items = providerResponse.value.map(site => ({
        id: site.id,
        ...(site.name !== undefined && { name: site.name }),
        ...(site.description !== undefined && { description: site.description }),
        ...(site.createdDateTime !== undefined && { createdDateTime: site.createdDateTime }),
        ...(site.lastModifiedDateTime !== undefined && { lastModifiedDateTime: site.lastModifiedDateTime }),
        ...(site.webUrl !== undefined && { webUrl: site.webUrl }),
      }));

      let next_cursor: string | undefined;
      if (providerResponse['@odata.nextLink']) {
        const nextLink = providerResponse['@odata.nextLink'];
        const url = new URL(nextLink);
        const skiptoken = url.searchParams.get('$skiptoken');
        if (skiptoken) {
          next_cursor = skiptoken;
        }
      }

      return {
        items,
        ...(next_cursor !== undefined && { next_cursor }),
      };
    },
  });
}
