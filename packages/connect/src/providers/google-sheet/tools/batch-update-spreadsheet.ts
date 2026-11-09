// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const batchUpdateSpreadsheetInputSchema = z.object({
  spreadsheetId: z.string(),
  requests: z.array(z.record(z.string(), z.unknown())),
});

const ReplySchema = z.record(z.string(), z.unknown());

export const batchUpdateSpreadsheetOutputSchema = z.object({
  spreadsheetId: z.string(),
  replies: z.array(ReplySchema),
  updatedRange: z.string().optional(),
  updatedCells: z.number().optional(),
  updatedColumns: z.number().optional(),
  updatedRows: z.number().optional(),
});

export function batchUpdateSpreadsheetTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_sheet_batch_update_spreadsheet',
    description: 'Apply multiple updates to a spreadsheet in a single request',
    inputSchema: batchUpdateSpreadsheetInputSchema,
    outputSchema: batchUpdateSpreadsheetOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof batchUpdateSpreadsheetOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/batchUpdate
        endpoint: `/v4/spreadsheets/${input.spreadsheetId}:batchUpdate`,
        data: {
          requests: input.requests,
        },
        retries: 3,
      });

      const result = response.data;

      return {
        spreadsheetId: result.spreadsheetId ?? input.spreadsheetId,
        replies: result.replies ?? [],
        updatedRange: result.updatedRange ?? undefined,
        updatedCells: result.updatedCells ?? undefined,
        updatedColumns: result.updatedColumns ?? undefined,
        updatedRows: result.updatedRows ?? undefined,
      };
    },
  });
}
