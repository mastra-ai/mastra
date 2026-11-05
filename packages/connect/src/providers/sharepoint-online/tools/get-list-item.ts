// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getListItemInputSchema = z.object({
  siteId: z.string().describe('SharePoint site ID. Example: "contoso.sharepoint.com,site-id"'),
  listId: z.string().describe('SharePoint list ID. Example: "list-id"'),
  itemId: z.string().describe('SharePoint list item ID. Example: "1"'),
  expandFields: z
    .boolean()
    .optional()
    .describe('Whether to expand the fields property to include custom column values.'),
});

const IdentitySetSchema = z.object({
  user: z
    .object({
      displayName: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
});

const ContentTypeInfoSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
});

const ParentReferenceSchema = z.object({
  id: z.string().optional(),
  siteId: z.string().optional(),
});

export const getListItemOutputSchema = z.object({
  id: z.string(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  webUrl: z.string().optional(),
  createdBy: IdentitySetSchema.optional(),
  lastModifiedBy: IdentitySetSchema.optional(),
  parentReference: ParentReferenceSchema.optional(),
  contentType: ContentTypeInfoSchema.optional(),
  fields: z.record(z.string(), z.unknown()).optional(),
});

export function getListItemTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_get_list_item',
    description: 'Retrieve a SharePoint list item by ID.',
    inputSchema: getListItemInputSchema,
    outputSchema: getListItemOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getListItemOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input.expandFields) {
        params['$expand'] = 'fields';
      }

      // https://learn.microsoft.com/graph/api/listitem-get
      const response = await platformProxy.get({
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/lists/${encodeURIComponent(input.listId)}/items/${encodeURIComponent(input.itemId)}`,
        params,
        retries: 3,
      });

      return getListItemOutputSchema.parse(response.data);
    },
  });
}
