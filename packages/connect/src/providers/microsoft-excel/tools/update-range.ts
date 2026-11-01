// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const updateRangeInputSchema = z.object({
  driveId: z
    .string()
    .describe('Drive ID. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"'),
  itemId: z.string().describe('Workbook item ID. Example: "01RFYLAYDQCQAOBGW2GVAYDEQMDDBL6JYU"'),
  worksheetIdOrName: z.string().describe('Worksheet ID or name. Example: "Sheet1"'),
  address: z.string().describe('Range address. Example: "A1:C2"'),
  values: z.array(z.array(z.unknown())).describe('2D array of cell values matching the range row/column count'),
});

const ProviderRangeSchema = z
  .object({
    address: z.string().optional(),
    cellCount: z.number().optional(),
    columnCount: z.number().optional(),
    rowCount: z.number().optional(),
    values: z.array(z.array(z.unknown())).optional(),
  })
  .passthrough();

export const updateRangeOutputSchema = z.object({
  address: z.string().optional(),
  cellCount: z.number().optional(),
  columnCount: z.number().optional(),
  rowCount: z.number().optional(),
  values: z.array(z.array(z.unknown())).optional(),
});

export function updateRangeTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_update_range',
    description: 'Write cell values into a specific range on a worksheet',
    inputSchema: updateRangeInputSchema,
    outputSchema: updateRangeOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateRangeOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // OData string literals require embedded single quotes to be doubled.
      const encodedWorksheet = encodeURIComponent(input.worksheetIdOrName.replace(/'/g, "''"));
      const encodedAddress = encodeURIComponent(input.address.replace(/'/g, "''"));

      const config: PlatformProxyRequest = {
        // https://learn.microsoft.com/en-us/graph/api/range-update
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/workbook/worksheets('${encodedWorksheet}')/range(address='${encodedAddress}')`,
        data: {
          values: input.values,
        },
        retries: 1,
      };

      const response = await platformProxy.patch(config);
      const providerRange = ProviderRangeSchema.parse(response.data);

      return {
        ...(providerRange.address != null && { address: providerRange.address }),
        ...(providerRange.cellCount != null && { cellCount: providerRange.cellCount }),
        ...(providerRange.columnCount != null && { columnCount: providerRange.columnCount }),
        ...(providerRange.rowCount != null && { rowCount: providerRange.rowCount }),
        ...(providerRange.values != null && { values: providerRange.values }),
      };
    },
  });
}
