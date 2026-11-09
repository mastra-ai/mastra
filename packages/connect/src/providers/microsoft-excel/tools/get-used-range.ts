// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getUsedRangeInputSchema = z.object({
  driveId: z
    .string()
    .describe('Drive ID. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"'),
  itemId: z.string().describe('Workbook file item ID. Example: "01RFYLAYDQCQAOBGW2GVAYDEQMDDBL6JYU"'),
  worksheetIdOrName: z.string().describe('Worksheet ID or name. Example: "Sheet1"'),
});

const ProviderRangeSchema = z.object({
  address: z.string().optional(),
  cellCount: z.number().optional(),
  columnCount: z.number().optional(),
  columnHidden: z.boolean().optional(),
  rowCount: z.number().optional(),
  rowHidden: z.boolean().optional(),
  values: z.array(z.array(z.unknown())).optional(),
  formulas: z.array(z.array(z.unknown())).optional(),
  text: z.array(z.array(z.unknown())).optional(),
  numberFormat: z.array(z.array(z.unknown())).optional(),
});

export const getUsedRangeOutputSchema = z.object({
  address: z.string().optional(),
  cellCount: z.number().optional(),
  columnCount: z.number().optional(),
  columnHidden: z.boolean().optional(),
  rowCount: z.number().optional(),
  rowHidden: z.boolean().optional(),
  values: z.array(z.array(z.unknown())).optional(),
  formulas: z.array(z.array(z.unknown())).optional(),
  text: z.array(z.array(z.unknown())).optional(),
  numberFormat: z.array(z.array(z.unknown())).optional(),
});

export function getUsedRangeTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_get_used_range',
    description: 'Read all non-empty cells on a worksheet.',
    inputSchema: getUsedRangeInputSchema,
    outputSchema: getUsedRangeOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getUsedRangeOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // OData string literals require embedded single quotes to be doubled.
      const encodedWorksheet = encodeURIComponent(input.worksheetIdOrName.replace(/'/g, "''"));

      // https://learn.microsoft.com/en-us/graph/api/worksheet-usedrange
      const response = await platformProxy.get({
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/workbook/worksheets('${encodedWorksheet}')/usedRange`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Used range not found for the specified worksheet.',
          driveId: input.driveId,
          itemId: input.itemId,
          worksheetIdOrName: input.worksheetIdOrName,
        });
      }

      const providerRange = ProviderRangeSchema.parse(response.data);

      return {
        ...(providerRange.address !== undefined && { address: providerRange.address }),
        ...(providerRange.cellCount !== undefined && { cellCount: providerRange.cellCount }),
        ...(providerRange.columnCount !== undefined && { columnCount: providerRange.columnCount }),
        ...(providerRange.columnHidden !== undefined && { columnHidden: providerRange.columnHidden }),
        ...(providerRange.rowCount !== undefined && { rowCount: providerRange.rowCount }),
        ...(providerRange.rowHidden !== undefined && { rowHidden: providerRange.rowHidden }),
        ...(providerRange.values !== undefined && { values: providerRange.values }),
        ...(providerRange.formulas !== undefined && { formulas: providerRange.formulas }),
        ...(providerRange.text !== undefined && { text: providerRange.text }),
        ...(providerRange.numberFormat !== undefined && { numberFormat: providerRange.numberFormat }),
      };
    },
  });
}
