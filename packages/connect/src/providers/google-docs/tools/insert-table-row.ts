// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const insertTableRowInputSchema = z.object({
  documentId: z.string().describe('Google Docs document ID. Example: "abc123"'),
  tableStartLocationIndex: z
    .number()
    .int()
    .nonnegative()
    .describe('Index of the table element in the body. Example: 211'),
  rowIndex: z.number().int().nonnegative().describe('Row index of the reference cell. Example: 0'),
  columnIndex: z.number().int().nonnegative().describe('Column index of the reference cell. Example: 0'),
  insertBelow: z.boolean().describe('Whether to insert below the reference cell (true) or above (false).'),
  segmentId: z.string().optional().describe('Segment ID for headers or footers. Omit for body.'),
});

const ProviderReplySchema = z.object({
  insertTableRow: z.object({}).optional(),
});

const ProviderResponseSchema = z.object({
  documentId: z.string(),
  replies: z.array(ProviderReplySchema).optional(),
  revisionId: z.string().optional(),
});

export const insertTableRowOutputSchema = z.object({
  documentId: z.string(),
  revisionId: z.string().optional(),
});

export function insertTableRowTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_insert_table_row',
    description: 'Insert a table row above or below a reference cell.',
    inputSchema: insertTableRowInputSchema,
    outputSchema: insertTableRowOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof insertTableRowOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              insertTableRow: {
                tableCellLocation: {
                  tableStartLocation: {
                    index: input.tableStartLocationIndex,
                    ...(input.segmentId !== undefined && { segmentId: input.segmentId }),
                  },
                  rowIndex: input.rowIndex,
                  columnIndex: input.columnIndex,
                },
                insertBelow: input.insertBelow,
              },
            },
          ],
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        documentId: providerResponse.documentId,
        ...(providerResponse.revisionId !== undefined && { revisionId: providerResponse.revisionId }),
      };
    },
  });
}
