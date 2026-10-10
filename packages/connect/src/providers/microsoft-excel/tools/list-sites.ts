// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listSitesInputSchema = z.object({
  query: z.string().optional().describe('Search query to filter sites. Example: "nango"'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor from the previous response (@odata.nextLink). Omit for the first page.'),
});

const ProviderSiteSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  webUrl: z.string().optional(),
});

export const listSitesOutputSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      createdDateTime: z.string().optional(),
      lastModifiedDateTime: z.string().optional(),
      webUrl: z.string().optional(),
    }),
  ),
  nextCursor: z.string().optional(),
});

export function listSitesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_list_sites',
    description: 'Search and list SharePoint sites accessible to the app.',
    inputSchema: listSitesInputSchema,
    outputSchema: listSitesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSitesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const baseUrl = 'https://graph.microsoft.com';
      let endpoint: string;
      const params: Record<string, string> = {};

      if (input.cursor) {
        endpoint = input.cursor.startsWith(baseUrl) ? input.cursor.slice(baseUrl.length) : input.cursor;
      } else {
        endpoint = '/v1.0/sites';
        if (input.query !== undefined && input.query !== '') {
          params['search'] = input.query;
        }
      }

      // https://learn.microsoft.com/en-us/graph/api/site-search
      const response = await platformProxy.get({
        endpoint,
        params,
        retries: 3,
      });

      const providerResponse = z
        .object({
          value: z.array(ProviderSiteSchema).optional(),
          '@odata.nextLink': z.string().optional(),
        })
        .parse(response.data);

      const items = (providerResponse.value || []).map(site => ({
        id: site.id,
        ...(site.name !== undefined && { name: site.name }),
        ...(site.description !== undefined && { description: site.description }),
        ...(site.createdDateTime !== undefined && { createdDateTime: site.createdDateTime }),
        ...(site.lastModifiedDateTime !== undefined && { lastModifiedDateTime: site.lastModifiedDateTime }),
        ...(site.webUrl !== undefined && { webUrl: site.webUrl }),
      }));

      return {
        items,
        ...(providerResponse['@odata.nextLink'] !== undefined && {
          nextCursor: providerResponse['@odata.nextLink'],
        }),
      };
    },
  });
}
