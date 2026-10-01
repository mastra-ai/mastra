// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const unmergeTableCellsInputSchema = z.object({
  documentId: z.string().describe('Google Docs document ID. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  tableRange: z.object({
    tableCellLocation: z.object({
      tableStartLocation: z.object({
        index: z
          .number()
          .int()
          .nonnegative()
          .describe('The zero-based index of the table element in the document body.'),
        segmentId: z
          .string()
          .optional()
          .describe('The ID of the header, footer or footnote. Empty or omitted signifies the document body.'),
        tabId: z.string().optional().describe('The tab that the location is in.'),
      }),
      rowIndex: z.number().int().nonnegative().describe('The zero-based row index of the starting cell.'),
      columnIndex: z.number().int().nonnegative().describe('The zero-based column index of the starting cell.'),
    }),
    rowSpan: z.number().int().min(1).optional().describe('The row span of the table range. Defaults to 1.'),
    columnSpan: z.number().int().min(1).optional().describe('The column span of the table range. Defaults to 1.'),
  }),
});

export const unmergeTableCellsOutputSchema = z.object({
  documentId: z.string(),
  replies: z.array(z.object({}).passthrough()).optional(),
  writeLocation: z
    .object({
      index: z.number().optional(),
      segmentId: z.string().optional(),
      tabId: z.string().optional(),
    })
    .optional(),
});

export function unmergeTableCellsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_unmerge_table_cells',
    description: 'Unmerge previously merged table cells in a Google Doc.',
    inputSchema: unmergeTableCellsInputSchema,
    outputSchema: unmergeTableCellsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof unmergeTableCellsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              unmergeTableCells: {
                tableRange: input.tableRange,
              },
            },
          ],
        },
        retries: 3,
      });

      const parsed = unmergeTableCellsOutputSchema.parse(response.data);
      return parsed;
    },
  });
}
