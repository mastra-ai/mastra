// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getListInputSchema = z.object({
  siteId: z.string().describe('SharePoint site ID. Example: "contoso.sharepoint.com,abc123,def456"'),
  listId: z.string().describe('SharePoint list ID. Example: "12345678-1234-1234-1234-123456789012"'),
});

const ProviderListSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  description: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  webUrl: z.string().optional().nullable(),
  createdDateTime: z.string().optional().nullable(),
  lastModifiedDateTime: z.string().optional().nullable(),
  list: z
    .object({
      template: z.string().optional().nullable(),
      contentTypesEnabled: z.boolean().optional().nullable(),
      hidden: z.boolean().optional().nullable(),
    })
    .optional()
    .nullable(),
});

export const getListOutputSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  name: z.string().optional(),
  webUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  template: z.string().optional(),
  contentTypesEnabled: z.boolean().optional(),
  hidden: z.boolean().optional(),
});

export function getListTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_get_list',
    description: 'Retrieve a SharePoint list by ID.',
    inputSchema: getListInputSchema,
    outputSchema: getListOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getListOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://learn.microsoft.com/graph/api/list-get
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/lists/${encodeURIComponent(input.listId)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'List not found',
        });
      }

      const providerList = ProviderListSchema.parse(response.data);

      return {
        id: providerList.id,
        ...(providerList.displayName !== undefined && { displayName: providerList.displayName }),
        ...(providerList.description != null && { description: providerList.description }),
        ...(providerList.name != null && { name: providerList.name }),
        ...(providerList.webUrl != null && { webUrl: providerList.webUrl }),
        ...(providerList.createdDateTime != null && { createdDateTime: providerList.createdDateTime }),
        ...(providerList.lastModifiedDateTime != null && { lastModifiedDateTime: providerList.lastModifiedDateTime }),
        ...(providerList.list?.template != null && { template: providerList.list.template }),
        ...(providerList.list?.contentTypesEnabled != null && {
          contentTypesEnabled: providerList.list.contentTypesEnabled,
        }),
        ...(providerList.list?.hidden != null && { hidden: providerList.list.hidden }),
      };
    },
  });
}
