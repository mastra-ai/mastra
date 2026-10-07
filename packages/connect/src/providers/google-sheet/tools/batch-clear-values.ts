// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const batchClearValuesInputSchema = z.object({
  spreadsheetId: z.string().describe('The ID of the spreadsheet to update. Example: "1a2b3c4d5e6f"'),
  ranges: z
    .array(z.string())
    .describe('The ranges to clear, in A1 notation. Example: ["Sheet1!A1:D10", "Sheet2!B2:C5"]'),
});

export const batchClearValuesOutputSchema = z.object({
  spreadsheetId: z.string().describe('The ID of the spreadsheet'),
  clearedRanges: z.array(z.string()).describe('The ranges that were cleared, in A1 notation'),
});

export function batchClearValuesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_sheet_batch_clear_values',
    description: 'Clear values from one or more ranges in a spreadsheet, preserving formatting',
    inputSchema: batchClearValuesInputSchema,
    outputSchema: batchClearValuesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof batchClearValuesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/batchClear
      const response = await platformProxy.post({
        endpoint: `/v4/spreadsheets/${input.spreadsheetId}/values:batchClear`,
        data: {
          ranges: input.ranges,
        },
        retries: 3,
      });

      return {
        spreadsheetId: response.data.spreadsheetId || input.spreadsheetId,
        clearedRanges: response.data.clearedRanges || [],
      };
    },
  });
}
