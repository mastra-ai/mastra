// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const clearValuesInputSchema = z.object({
  spreadsheetId: z.string().describe('The ID of the spreadsheet to update. Example: "1a2b3c4d5e6f7g8h9i0j"'),
  range: z.string().describe('The A1 notation or R1C1 notation of the values to clear. Example: "Sheet1!A1:D10"'),
});

export const clearValuesOutputSchema = z.object({
  spreadsheetId: z.string(),
  clearedRange: z.string(),
});

export function clearValuesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_sheet_clear_values',
    description: 'Clear values from a range, preserving formatting',
    inputSchema: clearValuesInputSchema,
    outputSchema: clearValuesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof clearValuesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/clear
      const response = await platformProxy.post({
        endpoint: `v4/spreadsheets/${input.spreadsheetId}/values/${encodeURIComponent(input.range)}:clear`,
        data: {},
        retries: 3,
      });

      return {
        spreadsheetId: response.data.spreadsheetId,
        clearedRange: response.data.clearedRange,
      };
    },
  });
}
