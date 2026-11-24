// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createSpreadsheetRowInputSchema = z.object({
  spreadsheetId: z
    .string()
    .describe('The ID of the spreadsheet. Example: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"'),
  sheetId: z.number().describe('The ID of the sheet (can be found via the API). Example: 687284948'),
  sheetName: z.string().describe('The name of the sheet for A1 notation. Example: "Sheet1"'),
  rowIndex: z.number().describe('The index where to insert the row (0-based, where 0 is the first row). Example: 5'),
  values: z
    .array(z.string())
    .describe('Array of values to insert in the new row. Example: ["John", "Doe", "john@example.com"]'),
});

export const createSpreadsheetRowOutputSchema = z.object({
  spreadsheetId: z.string(),
  sheetId: z.number(),
  rowIndex: z.number(),
  values: z.array(z.string()),
  updatedRange: z.string(),
});

export function createSpreadsheetRowTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_sheet_create_spreadsheet_row',
    description: 'Insert a new row at a given index in a Google Sheet',
    inputSchema: createSpreadsheetRowInputSchema,
    outputSchema: createSpreadsheetRowOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createSpreadsheetRowOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Step 1: Insert a new row at the specified index
      // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#InsertDimensionRequest
      await platformProxy.post({
        endpoint: `/v4/spreadsheets/${input.spreadsheetId}:batchUpdate`,
        data: {
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId: input.sheetId,
                  dimension: 'ROWS',
                  startIndex: input.rowIndex,
                  endIndex: input.rowIndex + 1,
                },
                inheritFromBefore: false,
              },
            },
          ],
        },
        retries: 3,
      });

      // Step 2: Update the values in the newly inserted row
      // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/update
      // Build range like "Sheet1!A5:C5" where row_index=4 (0-based) -> row 5 (1-based)
      const endColumn = input.values.length > 0 ? String.fromCharCode(65 + Math.min(input.values.length - 1, 25)) : 'A';
      const range = `${input.sheetName}!A${input.rowIndex + 1}:${endColumn}${input.rowIndex + 1}`;

      const updateResponse = await platformProxy.put({
        endpoint: `/v4/spreadsheets/${input.spreadsheetId}/values/${encodeURIComponent(range)}`,
        params: {
          valueInputOption: 'USER_ENTERED',
        },
        data: {
          majorDimension: 'ROWS',
          values: [input.values],
        },
        retries: 3,
      });

      return {
        spreadsheetId: input.spreadsheetId,
        sheetId: input.sheetId,
        rowIndex: input.rowIndex,
        values: input.values,
        updatedRange: updateResponse.data?.updatedRange || range,
      };
    },
  });
}
