// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteWorksheetInputSchema = z.object({
  spreadsheetId: z
    .string()
    .describe('The ID of the Google Spreadsheet. Example: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"'),
  worksheetName: z.string().describe('The name of the worksheet to delete. Example: "Sheet2"'),
});

export const deleteWorksheetOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export function deleteWorksheetTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_sheet_delete_worksheet',
    description: 'Delete a worksheet by name from a Google Spreadsheet',
    inputSchema: deleteWorksheetInputSchema,
    outputSchema: deleteWorksheetOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteWorksheetOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // First, get spreadsheet metadata to find the sheet ID by name
      // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/get
      const metadataResponse = await platformProxy.get({
        endpoint: `/v4/spreadsheets/${input.spreadsheetId}`,
        retries: 3,
      });

      const sheets = metadataResponse.data.sheets || [];
      const sheetToDelete = sheets.find(
        (sheet: { properties: { title: string } }) => sheet.properties.title === input.worksheetName,
      );

      if (!sheetToDelete) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Worksheet "${input.worksheetName}" not found in spreadsheet`,
          spreadsheetId: input.spreadsheetId,
          worksheetName: input.worksheetName,
        });
      }

      const sheetId = sheetToDelete.properties.sheetId;

      // Delete the sheet using batchUpdate
      // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/batchUpdate
      await platformProxy.post({
        endpoint: `/v4/spreadsheets/${input.spreadsheetId}:batchUpdate`,
        data: {
          requests: [
            {
              deleteSheet: {
                sheetId: sheetId,
              },
            },
          ],
        },
        retries: 3,
      });

      return {
        success: true,
        message: `Worksheet "${input.worksheetName}" deleted successfully`,
      };
    },
  });
}
