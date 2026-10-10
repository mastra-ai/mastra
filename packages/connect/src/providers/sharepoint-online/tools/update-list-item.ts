// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateListItemInputSchema = z.object({
  site_id: z.string().describe('SharePoint site ID. Example: "contoso.sharepoint.com,site-id"'),
  list_id: z.string().describe('SharePoint list ID. Example: "list-id"'),
  item_id: z.string().describe('SharePoint list item ID. Example: "1"'),
  fields: z.record(z.string(), z.unknown()).describe('Field values keyed by internal column name.'),
});

const ProviderFieldValueSetSchema = z.record(z.string(), z.unknown());

export const updateListItemOutputSchema = z.object({
  site_id: z.string(),
  list_id: z.string(),
  item_id: z.string(),
  fields: z.record(z.string(), z.unknown()),
});

export function updateListItemTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_update_list_item',
    description: 'Update fields on a SharePoint list item.',
    inputSchema: updateListItemInputSchema,
    outputSchema: updateListItemOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateListItemOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.patch({
        // https://learn.microsoft.com/graph/api/listitem-update
        endpoint: `/v1.0/sites/${encodeURIComponent(input.site_id)}/lists/${encodeURIComponent(input.list_id)}/items/${encodeURIComponent(input.item_id)}/fields`,
        data: input.fields,
        retries: 3,
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'Unexpected response from Microsoft Graph when updating list item fields.',
        });
      }

      const providerFields = ProviderFieldValueSetSchema.parse(response.data);

      return {
        site_id: input.site_id,
        list_id: input.list_id,
        item_id: input.item_id,
        fields: providerFields,
      };
    },
  });
}
