// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const copySheetInputSchema = z.object({
  sourceSpreadsheetId: z
    .string()
    .describe('The ID of the spreadsheet containing the sheet to copy. Example: "1aBcD..."'),
  sheetId: z.number().describe('The ID of the sheet to copy. Example: 123456789'),
  destinationSpreadsheetId: z.string().describe('The ID of the spreadsheet to copy the sheet to. Example: "2xYzA..."'),
});

export const copySheetOutputSchema = z.object({
  sheetId: z.number().describe('The ID of the newly copied sheet'),
  title: z.string().describe('The title of the newly copied sheet'),
  index: z.number().describe('The zero-based index of the sheet within the spreadsheet'),
  sheetType: z.string().describe('The type of sheet (GRID, OBJECT, etc.)'),
  rowCount: z.number().optional().describe('The number of rows in the grid, if applicable'),
  columnCount: z.number().optional().describe('The number of columns in the grid, if applicable'),
});

export function copySheetTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_sheet_copy_sheet',
    description: 'Copy a sheet to another spreadsheet',
    inputSchema: copySheetInputSchema,
    outputSchema: copySheetOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof copySheetOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.sheets/copyTo
        endpoint: `/v4/spreadsheets/${input.sourceSpreadsheetId}/sheets/${input.sheetId}:copyTo`,
        data: {
          destinationSpreadsheetId: input.destinationSpreadsheetId,
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'copy_failed',
          message: 'Failed to copy sheet',
          sourceSpreadsheetId: input.sourceSpreadsheetId,
          sheetId: input.sheetId,
          destinationSpreadsheetId: input.destinationSpreadsheetId,
        });
      }

      const properties = response.data;

      return {
        sheetId: properties.sheetId,
        title: properties.title,
        index: properties.index,
        sheetType: properties.sheetType,
        rowCount: properties.gridProperties?.rowCount,
        columnCount: properties.gridProperties?.columnCount,
      };
    },
  });
}
