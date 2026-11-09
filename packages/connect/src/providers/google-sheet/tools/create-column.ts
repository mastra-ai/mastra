// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createColumnInputSchema = z.object({
  spreadsheetId: z
    .string()
    .describe('The ID of the spreadsheet. Example: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"'),
  sheetId: z.number().optional().describe('The sheet ID (0-based). Defaults to 0 if not provided. Example: 0'),
  columnIndex: z
    .number()
    .describe('The zero-based column index where the new column will be inserted. Example: 2 to insert at column C'),
  inheritFromBefore: z
    .boolean()
    .optional()
    .describe(
      'If true, the new column inherits formatting from the previous column. If false or not set, inherits from the next column.',
    ),
});

export const createColumnOutputSchema = z.object({
  spreadsheetId: z.string(),
  sheetId: z.number(),
  columnIndex: z.number(),
  success: z.boolean(),
});

export function createColumnTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_sheet_create_column',
    description: 'Insert a new column into a sheet',
    inputSchema: createColumnInputSchema,
    outputSchema: createColumnOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createColumnOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const sheetId = input.sheetId ?? 0;

      // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/batchUpdate
      await platformProxy.post({
        endpoint: `/v4/spreadsheets/${input.spreadsheetId}:batchUpdate`,
        data: {
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: 'COLUMNS',
                  startIndex: input.columnIndex,
                  endIndex: input.columnIndex + 1,
                },
                ...(input.inheritFromBefore !== undefined && {
                  inheritFromBefore: input.inheritFromBefore,
                }),
              },
            },
          ],
        },
        retries: 3,
      });

      return {
        spreadsheetId: input.spreadsheetId,
        sheetId: sheetId,
        columnIndex: input.columnIndex,
        success: true,
      };
    },
  });
}
