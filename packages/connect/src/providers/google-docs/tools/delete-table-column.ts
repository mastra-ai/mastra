// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteTableColumnInputSchema = z.object({
  documentId: z.string().describe('Google Docs document ID. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  tableStartLocationIndex: z
    .number()
    .int()
    .nonnegative()
    .describe('The index of the table element in the document body. Example: 211'),
  rowIndex: z.number().int().nonnegative().describe('The row index of a cell in the column to delete. Example: 0'),
  columnIndex: z.number().int().nonnegative().describe('The column index to delete. Example: 1'),
});

export const deleteTableColumnOutputSchema = z.object({
  documentId: z.string(),
  success: z.boolean(),
});

export function deleteTableColumnTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_delete_table_column',
    description: 'Delete a table column using a reference cell.',
    inputSchema: deleteTableColumnInputSchema,
    outputSchema: deleteTableColumnOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteTableColumnOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              deleteTableColumn: {
                tableCellLocation: {
                  tableStartLocation: {
                    index: input.tableStartLocationIndex,
                  },
                  rowIndex: input.rowIndex,
                  columnIndex: input.columnIndex,
                },
              },
            },
          ],
        },
        retries: 3,
      });

      const BatchUpdateResponseSchema = z.object({
        replies: z.array(z.unknown()).optional(),
        documentId: z.string().optional(),
        revisionId: z.string().optional(),
      });

      const batchResponse = BatchUpdateResponseSchema.parse(response.data);

      if (!batchResponse.documentId && !batchResponse.replies) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'Unexpected response from Google Docs API',
        });
      }

      return {
        documentId: input.documentId,
        success: true,
      };
    },
  });
}
