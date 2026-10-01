// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const SheetPropertiesSchema = z
  .object({
    title: z.string().optional().describe('Sheet title. Example: "Sheet1"'),
    gridProperties: z
      .object({
        rowCount: z.number().optional(),
        columnCount: z.number().optional(),
      })
      .optional(),
  })
  .passthrough();

const SheetSchema = z
  .object({
    properties: SheetPropertiesSchema.optional(),
  })
  .passthrough();

const SpreadsheetPropertiesSchema = z
  .object({
    title: z.string().describe('Spreadsheet title. Example: "My New Spreadsheet"'),
    locale: z.string().optional().describe('Spreadsheet locale. Example: "en_US"'),
    timeZone: z.string().optional().describe('Spreadsheet time zone. Example: "America/New_York"'),
  })
  .passthrough();

export const createSpreadsheetInputSchema = z.object({
  properties: SpreadsheetPropertiesSchema.describe('Spreadsheet properties including title'),
  sheets: z.array(SheetSchema).optional().describe('Array of sheets to create in the spreadsheet'),
});

export const createSpreadsheetOutputSchema = z
  .object({
    spreadsheetId: z.string().describe('The unique ID of the created spreadsheet'),
    spreadsheetUrl: z.string().describe('The URL to view the spreadsheet in Google Sheets'),
    properties: z.any().optional(),
  })
  .passthrough();

export function createSpreadsheetTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_sheet_create_spreadsheet',
    description: 'Create a new spreadsheet',
    inputSchema: createSpreadsheetInputSchema,
    outputSchema: createSpreadsheetOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createSpreadsheetOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/create
      const response = await platformProxy.post({
        endpoint: '/v4/spreadsheets',
        data: {
          properties: input.properties,
          ...(input.sheets && { sheets: input.sheets }),
        },
        retries: 3,
      });

      return {
        spreadsheetId: response.data.spreadsheetId,
        spreadsheetUrl: response.data.spreadsheetUrl,
        properties: response.data.properties,
      };
    },
  });
}
