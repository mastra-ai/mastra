// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const appendValuesToSpreadsheetInputSchema = z.object({
  spreadsheetId: z
    .string()
    .describe('The ID of the spreadsheet to update. Example: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"'),
  range: z
    .string()
    .describe('The A1 notation of a range to search for a logical table of data. Example: "Sheet1!A1" or "Sheet1"'),
  values: z
    .array(z.any())
    .describe('The values to append to the spreadsheet. Each inner array represents a row of data.'),
  valueInputOption: z
    .string()
    .optional()
    .describe(
      'How the input data should be interpreted. "RAW": The values will be parsed as if the user typed them into the UI. "USER_ENTERED": The values will be parsed as if the user typed them into the UI, but formulas will be calculated.',
    ),
  insertDataOption: z
    .string()
    .optional()
    .describe(
      'How the input data should be inserted. "OVERWRITE": Overwrite existing data. "INSERT_ROWS": Insert new rows.',
    ),
  majorDimension: z
    .string()
    .optional()
    .describe(
      'The major dimension of the values. "ROWS": Values are organized by row. "COLUMNS": Values are organized by column.',
    ),
});

export const appendValuesToSpreadsheetOutputSchema = z.object({
  spreadsheetId: z.string(),
  tableRange: z.string(),
  updatedRange: z.string(),
  updatedRows: z.number(),
  updatedColumns: z.number(),
  updatedCells: z.number(),
});

export function appendValuesToSpreadsheetTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_sheet_append_values_to_spreadsheet',
    description: 'Append values to the end of a spreadsheet table',
    inputSchema: appendValuesToSpreadsheetInputSchema,
    outputSchema: appendValuesToSpreadsheetOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof appendValuesToSpreadsheetOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const valueInputOption = input.valueInputOption ?? 'USER_ENTERED';
      const insertDataOption = input.insertDataOption ?? 'INSERT_ROWS';
      const majorDimension = input.majorDimension ?? 'ROWS';

      const response = await platformProxy.post({
        // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/append
        endpoint: `/v4/spreadsheets/${input.spreadsheetId}/values/${encodeURIComponent(input.range)}:append`,
        params: {
          valueInputOption: valueInputOption,
          insertDataOption: insertDataOption,
          includeValuesInResponse: 'true',
        },
        data: {
          values: input.values,
          majorDimension: majorDimension,
        },
        retries: 3,
      });

      const updates = response.data?.updates;

      if (!updates) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Google Sheets API: missing updates data',
        });
      }

      return {
        spreadsheetId: response.data.spreadsheetId || input.spreadsheetId,
        tableRange: response.data.tableRange || '',
        updatedRange: updates.updatedRange || '',
        updatedRows: updates.updatedRows || 0,
        updatedColumns: updates.updatedColumns || 0,
        updatedCells: updates.updatedCells || 0,
      };
    },
  });
}
