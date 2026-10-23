// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const addTableRowsInputSchema = z.object({
  driveId: z.string().describe('Drive ID. Example: "b!PkCXTGMW..."'),
  itemId: z.string().describe('Workbook item ID. Example: "01RFYLAYD..."'),
  tableIdOrName: z.string().describe('Table ID or name. Example: "Table1"'),
  values: z
    .array(z.array(z.unknown()))
    .describe('2-dimensional array of row values. Example: [["Alice", 100], ["Bob", 200]]'),
});

const ProviderTableRowSchema = z.object({
  index: z.number().optional(),
  values: z.array(z.array(z.unknown())).optional(),
});

export const addTableRowsOutputSchema = ProviderTableRowSchema;

export function addTableRowsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_add_table_rows',
    description: 'Append one or more rows to a table.',
    inputSchema: addTableRowsInputSchema,
    outputSchema: addTableRowsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof addTableRowsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // OData string literals require embedded single quotes to be doubled.
      const encodedTable = encodeURIComponent(input.tableIdOrName.replace(/'/g, "''"));

      const response = await platformProxy.post({
        // https://learn.microsoft.com/en-us/graph/api/tablerowcollection-add
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/workbook/tables('${encodedTable}')/rows/add`,
        data: {
          values: input.values,
        },
        retries: 3,
      });

      const row = ProviderTableRowSchema.parse(response.data);

      return {
        ...(row.index !== undefined && { index: row.index }),
        ...(row.values !== undefined && { values: row.values }),
      };
    },
  });
}
