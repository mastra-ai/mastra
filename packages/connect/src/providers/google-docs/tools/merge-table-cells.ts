// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const TableStartLocationSchema = z.object({
  index: z.number().int().nonnegative().describe('The index of the table element in the document body. Example: 211'),
  segmentId: z.string().optional().describe('The segment ID; omit for the body segment. Example: ""'),
});

export const mergeTableCellsInputSchema = z.object({
  documentId: z
    .string()
    .describe('The ID of the document containing the table. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  tableStartLocation: TableStartLocationSchema.describe('The location of the table in the document'),
  rowIndex: z
    .number()
    .int()
    .nonnegative()
    .describe('The row index of the first cell in the range (0-based). Example: 0'),
  columnIndex: z
    .number()
    .int()
    .nonnegative()
    .describe('The column index of the first cell in the range (0-based). Example: 0'),
  rowSpan: z.number().int().min(1).describe('The number of rows in the range. Example: 1'),
  columnSpan: z.number().int().min(1).describe('The number of columns in the range. Example: 2'),
});

const BatchUpdateResponseSchema = z.object({
  documentId: z.string(),
  replies: z.array(z.unknown()).optional(),
});

export const mergeTableCellsOutputSchema = z.object({
  documentId: z.string(),
  merged: z.boolean(),
});

export function mergeTableCellsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_merge_table_cells',
    description: 'Merge a rectangular range of table cells in a Google Doc',
    inputSchema: mergeTableCellsInputSchema,
    outputSchema: mergeTableCellsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof mergeTableCellsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
      const response = await platformProxy.post({
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              mergeTableCells: {
                tableRange: {
                  tableCellLocation: {
                    tableStartLocation: {
                      index: input.tableStartLocation.index,
                      ...(input.tableStartLocation.segmentId !== undefined && {
                        segmentId: input.tableStartLocation.segmentId,
                      }),
                    },
                    rowIndex: input.rowIndex,
                    columnIndex: input.columnIndex,
                  },
                  rowSpan: input.rowSpan,
                  columnSpan: input.columnSpan,
                },
              },
            },
          ],
        },
        retries: 3,
      });

      const parsed = BatchUpdateResponseSchema.parse(response.data);

      return {
        documentId: parsed.documentId,
        merged: true,
      };
    },
  });
}
