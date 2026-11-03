// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listListsInputSchema = z.object({
  siteId: z.string().describe('SharePoint site ID. Example: "contoso.sharepoint.com,site-id,web-id"'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const ProviderListSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  displayName: z.string().optional(),
  description: z.string().optional().nullable(),
  webUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  list: z
    .object({
      template: z.string().optional(),
      hidden: z.boolean().optional(),
      contentTypesEnabled: z.boolean().optional(),
    })
    .optional()
    .nullable(),
});

const ListItemSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  webUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  listTemplate: z.string().optional(),
  hidden: z.boolean().optional(),
  contentTypesEnabled: z.boolean().optional(),
});

export const listListsOutputSchema = z.object({
  items: z.array(ListItemSchema),
  nextCursor: z.string().optional(),
});

export function listListsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_list_lists',
    description: 'List SharePoint lists on a site.',
    inputSchema: listListsInputSchema,
    outputSchema: listListsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listListsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/site-list-lists
      const response = await platformProxy.get({
        // https://learn.microsoft.com/graph/api/site-list-lists
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/lists`,
        params: {
          $top: '50',
          ...(input.cursor !== undefined && { $skiptoken: input.cursor }),
        },
        retries: 3,
      });

      const providerData = z
        .object({
          value: z.array(z.unknown()),
          '@odata.nextLink': z.string().optional(),
        })
        .parse(response.data);

      const items = providerData.value.map((item: unknown) => {
        const list = ProviderListSchema.parse(item);

        return {
          id: list.id,
          ...(list.name !== undefined && { name: list.name }),
          ...(list.displayName !== undefined && { displayName: list.displayName }),
          ...(list.description !== undefined && list.description !== null && { description: list.description }),
          ...(list.webUrl !== undefined && { webUrl: list.webUrl }),
          ...(list.createdDateTime !== undefined && { createdDateTime: list.createdDateTime }),
          ...(list.lastModifiedDateTime !== undefined && { lastModifiedDateTime: list.lastModifiedDateTime }),
          ...(list.list?.template !== undefined && { listTemplate: list.list.template }),
          ...(list.list?.hidden !== undefined && { hidden: list.list.hidden }),
          ...(list.list?.contentTypesEnabled !== undefined && { contentTypesEnabled: list.list.contentTypesEnabled }),
        };
      });

      let nextCursor: string | undefined;
      if (providerData['@odata.nextLink'] !== undefined) {
        const nextLink = providerData['@odata.nextLink'];
        const skiptokenMatch = nextLink.match(/\$skiptoken=([^&]+)/);
        if (skiptokenMatch && skiptokenMatch[1] !== undefined) {
          nextCursor = decodeURIComponent(skiptokenMatch[1]);
        }
      }

      return {
        items,
        ...(nextCursor !== undefined && { nextCursor }),
      };
    },
  });
}
