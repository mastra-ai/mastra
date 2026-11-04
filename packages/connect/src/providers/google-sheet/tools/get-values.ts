// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getValuesInputSchema = z.object({
  spreadsheetId: z.string().describe('The ID of the spreadsheet to retrieve data from. Example: "1aBcD..."'),
  range: z
    .string()
    .describe(
      'The A1 notation or R1C1 notation of the range to retrieve values from. Example: "Sheet1!A1:C10" or "Sheet1"',
    ),
});

export const getValuesOutputSchema = z.object({
  spreadsheetId: z.string(),
  range: z.string(),
  majorDimension: z.enum(['ROWS', 'COLUMNS']).or(z.string()),
  values: z.any().describe('The data values in the range, as a 2D array where each inner array represents a row'),
});

export function getValuesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_sheet_get_values',
    description: 'Get values from a spreadsheet range',
    inputSchema: getValuesInputSchema,
    outputSchema: getValuesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getValuesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/get
      const response = await platformProxy.get({
        endpoint: `/v4/spreadsheets/${encodeURIComponent(input.spreadsheetId)}/values/${encodeURIComponent(input.range)}`,
        retries: 3,
      });

      const data = response.data;

      // Google Sheets API returns camelCase field names
      const spreadsheetId = data.spreadsheetId || data.spreadsheetId || input.spreadsheetId;
      const range = data.range || input.range;
      const majorDimension = data.majorDimension || 'ROWS';
      const values = data.values || [];

      return {
        spreadsheetId: spreadsheetId,
        range: range,
        majorDimension: majorDimension,
        values: values,
      };
    },
  });
}
