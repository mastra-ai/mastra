// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const DataFilterSchema = z
  .object({
    developerMetadataLookup: z
      .object({
        locationType: z.enum(['SPREADSHEET', 'SHEET', 'ROW', 'COLUMN']).optional(),
        metadataLocation: z
          .object({
            spreadsheet: z.boolean().optional(),
            sheetId: z.number().optional(),
            dimensionRange: z
              .object({
                sheetId: z.number(),
                dimension: z.enum(['ROWS', 'COLUMNS']),
                startIndex: z.number().optional(),
                endIndex: z.number().optional(),
              })
              .optional(),
          })
          .optional(),
        locationMatchingStrategy: z.enum(['EXACT_LOCATION', 'INTERSECTING_LOCATION']).optional(),
        metadataId: z.number().optional(),
        metadataKey: z.string().optional(),
        metadataValue: z.string().optional(),
        visibility: z.enum(['DOCUMENT', 'PROJECT']).optional(),
      })
      .optional()
      .describe('Selects data associated with developer metadata'),
    a1Range: z.string().optional().describe('Selects data matching A1 range notation (e.g., "Sheet1!A1:C10")'),
    gridRange: z
      .object({
        sheetId: z.number().optional(),
        startRowIndex: z.number().optional(),
        endRowIndex: z.number().optional(),
        startColumnIndex: z.number().optional(),
        endColumnIndex: z.number().optional(),
      })
      .optional()
      .describe('Selects data matching a GridRange'),
  })
  .describe('Filter to select which ranges to retrieve from the spreadsheet');

export const getSpreadsheetByDataFilterInputSchema = z.object({
  spreadsheetId: z.string().describe('The ID of the spreadsheet to retrieve. Example: "1a2b3c4d5e6f7g8h9i0j"'),
  dataFilters: z
    .array(DataFilterSchema)
    .describe('The data filters used to select which ranges to retrieve from the spreadsheet'),
  includeGridData: z
    .boolean()
    .optional()
    .describe('True if grid data should be returned. Ignored if a field mask is set in the request'),
  excludeTablesInBandedRanges: z
    .boolean()
    .optional()
    .describe('True if tables should be excluded in the banded ranges'),
});

export const getSpreadsheetByDataFilterOutputSchema = z
  .unknown()
  .describe('Spreadsheet object with data matching the specified filters');

export function getSpreadsheetByDataFilterTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_sheet_get_spreadsheet_by_data_filter',
    description: 'Get spreadsheet data matching data filters',
    inputSchema: getSpreadsheetByDataFilterInputSchema,
    outputSchema: getSpreadsheetByDataFilterOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getSpreadsheetByDataFilterOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody = {
        dataFilters: input.dataFilters,
        includeGridData: input.includeGridData ?? false,
        excludeTablesInBandedRanges: input.excludeTablesInBandedRanges ?? false,
      };

      const response = await platformProxy.post({
        endpoint: `/v4/spreadsheets/${input.spreadsheetId}:getByDataFilter`,
        data: requestBody,
        retries: 3,
      });

      return response.data;
    },
  });
}
