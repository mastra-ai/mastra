// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const addTableInputSchema = z.object({
  driveId: z.string().describe('Drive ID. Example: "b!abc123"'),
  itemId: z.string().describe('Workbook item ID. Example: "01RFYLAYDQCQAOBGW2GVAYDEQMDDBL6JYU"'),
  address: z.string().describe('Range address for the table. Example: "Sheet1!A1:C2"'),
  hasHeaders: z.boolean().optional().describe('Whether the first row of the range contains headers.'),
});

const TableColumnSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  values: z.array(z.unknown()).optional(),
});

const TableRowSchema = z.object({
  index: z.number().optional(),
  values: z.array(z.unknown()).optional(),
});

const ProviderTableSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  showHeaders: z.boolean().optional(),
  showTotals: z.boolean().optional(),
  style: z.string().optional(),
  highlightLastColumn: z.boolean().optional(),
  highlightFirstColumn: z.boolean().optional(),
  columns: z.array(TableColumnSchema).optional(),
  rows: z.array(TableRowSchema).optional(),
});

export const addTableOutputSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  showHeaders: z.boolean().optional(),
  showTotals: z.boolean().optional(),
  style: z.string().optional(),
  highlightLastColumn: z.boolean().optional(),
  highlightFirstColumn: z.boolean().optional(),
  columns: z.array(TableColumnSchema).optional(),
  rows: z.array(TableRowSchema).optional(),
});

export function addTableTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_add_table',
    description: 'Create a table from an existing range.',
    inputSchema: addTableInputSchema,
    outputSchema: addTableOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof addTableOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://learn.microsoft.com/en-us/graph/api/tablecollection-add
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/workbook/tables/add`,
        data: {
          address: input.address,
          ...(input.hasHeaders !== undefined && { hasHeaders: input.hasHeaders }),
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'Provider returned empty response when adding table.',
        });
      }

      const table = ProviderTableSchema.parse(response.data);

      return {
        ...(table.id !== undefined && { id: table.id }),
        ...(table.name !== undefined && { name: table.name }),
        ...(table.showHeaders !== undefined && { showHeaders: table.showHeaders }),
        ...(table.showTotals !== undefined && { showTotals: table.showTotals }),
        ...(table.style !== undefined && { style: table.style }),
        ...(table.highlightLastColumn !== undefined && { highlightLastColumn: table.highlightLastColumn }),
        ...(table.highlightFirstColumn !== undefined && { highlightFirstColumn: table.highlightFirstColumn }),
        ...(table.columns !== undefined && { columns: table.columns }),
        ...(table.rows !== undefined && { rows: table.rows }),
      };
    },
  });
}
