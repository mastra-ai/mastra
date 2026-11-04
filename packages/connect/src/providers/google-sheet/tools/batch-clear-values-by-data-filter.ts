// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const GridRangeSchema = z.object({
  sheetId: z.number().describe('The ID of the sheet. Example: 0'),
  startRowIndex: z.number().optional().describe('The start row (inclusive). Optional for unbounded.'),
  endRowIndex: z.number().optional().describe('The end row (exclusive). Optional for unbounded.'),
  startColumnIndex: z.number().optional().describe('The start column (inclusive). Optional for unbounded.'),
  endColumnIndex: z.number().optional().describe('The end column (exclusive). Optional for unbounded.'),
});

const DeveloperMetadataLocationSchema = z.object({
  locationType: z.enum(['ROW', 'COLUMN', 'SHEET', 'SPREADSHEET']).optional(),
  dimensionRange: z
    .object({
      sheetId: z.number(),
      dimension: z.enum(['ROWS', 'COLUMNS']),
      startIndex: z.number().optional(),
      endIndex: z.number().optional(),
    })
    .optional(),
});

const DeveloperMetadataLookupSchema = z.object({
  metadataId: z.number().optional(),
  metadataKey: z.string().optional(),
  metadataValue: z.string().optional(),
  locationMatchingStrategy: z.enum(['EXACT_LOCATION', 'INTERSECTING_LOCATION']).optional(),
  location: DeveloperMetadataLocationSchema.optional(),
  visibility: z.enum(['DOCUMENT', 'PROJECT']).optional(),
});

const DataFilterSchema = z
  .object({
    a1Range: z.string().optional().describe('A1 notation range. Example: "Sheet1!A1:B10"'),
    gridRange: GridRangeSchema.optional(),
    developerMetadataLookup: DeveloperMetadataLookupSchema.optional(),
  })
  .refine(
    data => {
      const count = [data.a1Range, data.gridRange, data.developerMetadataLookup].filter(Boolean).length;
      return count === 1;
    },
    {
      message: 'Exactly one of a1_range, grid_range, or developer_metadata_lookup must be provided',
    },
  );

export const batchClearValuesByDataFilterInputSchema = z.object({
  spreadsheetId: z.string().describe('The ID of the spreadsheet to update. Example: "1abc123xyz"'),
  dataFilters: z.array(DataFilterSchema).min(1).describe('The data filters used to determine which ranges to clear'),
});

export const batchClearValuesByDataFilterOutputSchema = z.object({
  spreadsheetId: z.string().describe('The ID of the spreadsheet'),
  clearedRanges: z.array(z.string()).describe('The ranges that were cleared, in A1 notation'),
});

export function batchClearValuesByDataFilterTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_sheet_batch_clear_values_by_data_filter',
    description: 'Clear values from ranges matching data filters, preserving formatting',
    inputSchema: batchClearValuesByDataFilterInputSchema,
    outputSchema: batchClearValuesByDataFilterOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof batchClearValuesByDataFilterOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/batchClearByDataFilter
        endpoint: `/v4/spreadsheets/${input.spreadsheetId}/values:batchClearByDataFilter`,
        data: {
          dataFilters: input.dataFilters.map(filter => {
            if (filter.a1Range) {
              return { a1Range: filter.a1Range };
            }
            if (filter.gridRange) {
              return {
                gridRange: {
                  sheetId: filter.gridRange.sheetId,
                  startRowIndex: filter.gridRange.startRowIndex,
                  endRowIndex: filter.gridRange.endRowIndex,
                  startColumnIndex: filter.gridRange.startColumnIndex,
                  endColumnIndex: filter.gridRange.endColumnIndex,
                },
              };
            }
            if (filter.developerMetadataLookup) {
              const lookup = filter.developerMetadataLookup;
              return {
                developerMetadataLookup: {
                  ...(lookup.metadataId !== undefined && { metadataId: lookup.metadataId }),
                  ...(lookup.metadataKey && { metadataKey: lookup.metadataKey }),
                  ...(lookup.metadataValue && { metadataValue: lookup.metadataValue }),
                  ...(lookup.locationMatchingStrategy && { locationMatchingStrategy: lookup.locationMatchingStrategy }),
                  ...(lookup.location && {
                    location: {
                      ...(lookup.location.locationType && { locationType: lookup.location.locationType }),
                      ...(lookup.location.dimensionRange && {
                        dimensionRange: {
                          sheetId: lookup.location.dimensionRange.sheetId,
                          dimension: lookup.location.dimensionRange.dimension,
                          startIndex: lookup.location.dimensionRange.startIndex,
                          endIndex: lookup.location.dimensionRange.endIndex,
                        },
                      }),
                    },
                  }),
                  ...(lookup.visibility && { visibility: lookup.visibility }),
                },
              };
            }
            return {};
          }),
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: 'Failed to clear values',
        });
      }

      return {
        spreadsheetId: response.data.spreadsheetId,
        clearedRanges: response.data.clearedRanges || [],
      };
    },
  });
}
