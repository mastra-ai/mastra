// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteTableInputSchema = z.object({
  driveId: z
    .string()
    .describe('Drive ID. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"'),
  itemId: z.string().describe('Workbook item ID. Example: "01RFYLAYDQCQAOBGW2GVAYDEQMDDBL6JYU"'),
  tableIdOrName: z.string().describe('Table ID or name. Example: "Table1"'),
});

export const deleteTableOutputSchema = z.object({
  success: z.boolean(),
});

export function deleteTableTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_delete_table',
    description: 'Delete a table (converts it back to a normal range; does not delete the underlying cell data).',
    inputSchema: deleteTableInputSchema,
    outputSchema: deleteTableOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteTableOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // OData string literals require embedded single quotes to be doubled.
      const encodedTable = encodeURIComponent(input.tableIdOrName.replace(/'/g, "''"));

      // https://learn.microsoft.com/en-us/graph/api/resources/excel
      // https://learn.microsoft.com/en-us/graph/api/resources/workbook
      await platformProxy.delete({
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/workbook/tables('${encodedTable}')`,
        retries: 3,
      });

      return { success: true };
    },
  });
}
