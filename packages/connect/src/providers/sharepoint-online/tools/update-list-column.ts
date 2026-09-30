// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateListColumnInputSchema = z.object({
  siteId: z
    .string()
    .describe(
      'SharePoint site ID. Example: "contoso.sharepoint.com,12345678-1234-1234-1234-123456789012,abcdef12-1234-1234-1234-123456789012"',
    ),
  listId: z.string().describe('SharePoint list ID. Example: "12345678-1234-1234-1234-123456789012"'),
  columnId: z.string().describe('SharePoint column ID. Example: "12345678-1234-1234-1234-123456789012"'),
  columnDefinition: z.object({}).passthrough().describe('The columnDefinition properties to update.'),
});

const ProviderColumnSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    displayName: z.string().optional(),
    description: z.string().optional(),
    required: z.boolean().optional(),
    hidden: z.boolean().optional(),
    indexed: z.boolean().optional(),
    enforceUniqueValues: z.boolean().optional(),
    columnGroup: z.string().optional(),
  })
  .passthrough();

export const updateListColumnOutputSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    displayName: z.string().optional(),
    description: z.string().optional(),
    required: z.boolean().optional(),
    hidden: z.boolean().optional(),
    indexed: z.boolean().optional(),
    enforceUniqueValues: z.boolean().optional(),
    columnGroup: z.string().optional(),
  })
  .passthrough();

export function updateListColumnTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_update_list_column',
    description: 'Update a SharePoint list column.',
    inputSchema: updateListColumnInputSchema,
    outputSchema: updateListColumnOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateListColumnOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.patch({
        // https://learn.microsoft.com/graph/api/columnDefinition-update
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/lists/${encodeURIComponent(input.listId)}/columns/${encodeURIComponent(input.columnId)}`,
        data: input.columnDefinition,
        retries: 3,
      });

      const providerColumn = ProviderColumnSchema.parse(response.data);

      return {
        ...(providerColumn.id !== undefined && { id: providerColumn.id }),
        ...(providerColumn.name !== undefined && { name: providerColumn.name }),
        ...(providerColumn.displayName !== undefined && { displayName: providerColumn.displayName }),
        ...(providerColumn.description !== undefined && { description: providerColumn.description }),
        ...(providerColumn.required !== undefined && { required: providerColumn.required }),
        ...(providerColumn.hidden !== undefined && { hidden: providerColumn.hidden }),
        ...(providerColumn.indexed !== undefined && { indexed: providerColumn.indexed }),
        ...(providerColumn.enforceUniqueValues !== undefined && {
          enforceUniqueValues: providerColumn.enforceUniqueValues,
        }),
        ...(providerColumn.columnGroup !== undefined && { columnGroup: providerColumn.columnGroup }),
        ...Object.entries(providerColumn)
          .filter(
            ([key]) =>
              ![
                'id',
                'name',
                'displayName',
                'description',
                'required',
                'hidden',
                'indexed',
                'enforceUniqueValues',
                'columnGroup',
              ].includes(key),
          )
          .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
      };
    },
  });
}
