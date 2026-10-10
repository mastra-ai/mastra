// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listListColumnsInputSchema = z.object({
  siteId: z
    .string()
    .describe(
      'SharePoint site ID. Example: "nangodevelopers.sharepoint.com,1d6e1722-9330-4b30-aa92-b73f215d9420,413c102d-9557-4a8d-8a68-bbb499015216"',
    ),
  listId: z.string().describe('SharePoint list ID. Example: "eca0d94a-d37a-46ee-9fa4-340a2e0c39f2"'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor (the @odata.nextLink URL from the previous response). Omit for the first page.'),
});

const ProviderColumnSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    displayName: z.string(),
    description: z.string().optional(),
    columnGroup: z.string().optional(),
    hidden: z.boolean().optional(),
    indexed: z.boolean().optional(),
    readOnly: z.boolean().optional(),
    required: z.boolean().optional(),
    enforceUniqueValues: z.boolean().optional(),
  })
  .passthrough();

export const listListColumnsOutputSchema = z.object({
  columns: z.array(ProviderColumnSchema),
  nextLink: z.string().optional().describe('The @odata.nextLink URL for the next page of results, if any.'),
});

export function listListColumnsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_list_list_columns',
    description: 'List columns on a SharePoint list.',
    inputSchema: listListColumnsInputSchema,
    outputSchema: listListColumnsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listListColumnsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      let endpoint = `/v1.0/sites/${encodeURIComponent(input.siteId)}/lists/${encodeURIComponent(input.listId)}/columns`;
      let params: Record<string, string> | undefined;
      if (input.cursor) {
        const cursorUrl = new URL(input.cursor);
        endpoint = cursorUrl.pathname;
        params = {};
        for (const [key, value] of cursorUrl.searchParams.entries()) {
          params[key] = value;
        }
      }

      // https://learn.microsoft.com/graph/api/list-list-columns
      const response = await platformProxy.get({
        endpoint,
        ...(params !== undefined ? { params } : {}),
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'empty_response',
          message: 'The provider returned an empty response.',
        });
      }

      const ProviderResponseSchema = z.object({
        value: z.array(ProviderColumnSchema),
        '@odata.nextLink': z.string().optional(),
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        columns: providerResponse.value,
        ...(providerResponse['@odata.nextLink'] != null ? { nextLink: providerResponse['@odata.nextLink'] } : {}),
      };
    },
  });
}
