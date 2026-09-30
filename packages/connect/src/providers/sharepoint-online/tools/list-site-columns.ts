// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listSiteColumnsInputSchema = z.object({
  siteId: z.string().describe('The ID of the SharePoint site.'),
  cursor: z.string().url().optional().describe('Pagination cursor from a previous response.'),
});

const ColumnTextSchema = z
  .object({
    allowMultipleLines: z.boolean().optional(),
    appendChangesToExistingText: z.boolean().optional(),
    linesForEditing: z.number().optional(),
    maxLength: z.number().optional(),
  })
  .optional();

const ColumnDefinitionSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    displayName: z.string().optional(),
    description: z.string().optional(),
    hidden: z.boolean().optional(),
    indexed: z.boolean().optional(),
    readOnly: z.boolean().optional(),
    required: z.boolean().optional(),
    text: ColumnTextSchema,
  })
  .passthrough();

export const listSiteColumnsOutputSchema = z.object({
  columns: z.array(ColumnDefinitionSchema),
  nextCursor: z.string().optional(),
});

export function listSiteColumnsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_list_site_columns',
    description: 'List site-level column definitions on a SharePoint site.',
    inputSchema: listSiteColumnsInputSchema,
    outputSchema: listSiteColumnsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSiteColumnsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const cursorUrl = input.cursor ? new URL(input.cursor) : null;

      const config: PlatformProxyRequest = {
        // https://learn.microsoft.com/graph/api/site-list-columns
        endpoint: cursorUrl
          ? cursorUrl.pathname + cursorUrl.search
          : `v1.0/sites/${encodeURIComponent(input.siteId)}/columns`,
        ...(cursorUrl ? { baseUrlOverride: cursorUrl.origin } : {}),
        retries: 3,
      };

      const response = await platformProxy.get(config);
      const data = response.data;

      const responseSchema = z.object({
        value: z.array(z.unknown()),
        '@odata.nextLink': z.string().optional(),
      });

      const parsedResponse = responseSchema.safeParse(data);
      if (!parsedResponse.success) {
        throw new platformProxy.ActionError({
          message: 'Unexpected response format from SharePoint API',
        });
      }

      const columns = parsedResponse.data.value.map(item => {
        const parsed = ColumnDefinitionSchema.safeParse(item);
        if (!parsed.success) {
          throw new platformProxy.ActionError({
            message: 'Invalid column definition in response',
          });
        }
        return parsed.data;
      });

      return {
        columns,
        nextCursor: parsedResponse.data['@odata.nextLink'],
      };
    },
  });
}
