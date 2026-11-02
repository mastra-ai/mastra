// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listTableRowsInputSchema = z.object({
  driveId: z
    .string()
    .describe(
      'Drive ID containing the workbook. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"',
    ),
  itemId: z.string().describe('Workbook item ID. Example: "01RFYLAYDQCQAOBGW2GVAYDEQMDDBL6JYU"'),
  tableIdOrName: z.string().describe('Table ID or name. Example: "Table1"'),
});

const GraphTableRowSchema = z.object({
  index: z.number(),
  values: z.array(z.array(z.unknown())),
});

const GraphTableRowsResponseSchema = z.object({
  value: z.array(GraphTableRowSchema).optional().default([]),
  '@odata.nextLink': z.string().optional(),
});

export const listTableRowsOutputSchema = z.object({
  rows: z.array(GraphTableRowSchema),
  nextLink: z.string().optional(),
});

export function listTableRowsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_list_table_rows',
    description: 'List the data rows of a table.',
    inputSchema: listTableRowsInputSchema,
    outputSchema: listTableRowsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listTableRowsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // OData string literals require embedded single quotes to be doubled.
      const encodedTable = encodeURIComponent(input.tableIdOrName.replace(/'/g, "''"));

      const response = await platformProxy.get({
        // https://learn.microsoft.com/en-us/graph/api/table-list-rows
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/workbook/tables('${encodedTable}')/rows`,
        retries: 3,
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Microsoft Graph API.',
        });
      }

      const parsed = GraphTableRowsResponseSchema.parse(response.data);

      return {
        rows: parsed.value,
        ...(parsed['@odata.nextLink'] != null && { nextLink: parsed['@odata.nextLink'] }),
      };
    },
  });
}
