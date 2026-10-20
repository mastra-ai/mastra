// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const insertTableColumnInputSchema = z.object({
  documentId: z.string().describe('Google Docs document ID. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  tableStartLocationIndex: z
    .number()
    .int()
    .min(0)
    .describe('The index of the table element in the document body. Example: 211'),
  rowIndex: z.number().int().min(0).describe('The zero-based row index of the reference cell. Example: 1'),
  columnIndex: z.number().int().min(0).describe('The zero-based column index of the reference cell. Example: 1'),
  insertRight: z
    .boolean()
    .optional()
    .describe(
      'Whether to insert the column to the right of the reference cell. Defaults to false (insert to the left).',
    ),
});

const BatchUpdateResponseSchema = z.object({
  documentId: z.string(),
  replies: z.array(z.unknown()).optional(),
});

export const insertTableColumnOutputSchema = z.object({
  documentId: z.string(),
});

export function insertTableColumnTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_insert_table_column',
    description: 'Insert a table column to the left or right of a reference cell.',
    inputSchema: insertTableColumnInputSchema,
    outputSchema: insertTableColumnOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof insertTableColumnOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
      const response = await platformProxy.post({
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              insertTableColumn: {
                tableCellLocation: {
                  tableStartLocation: {
                    index: input.tableStartLocationIndex,
                  },
                  rowIndex: input.rowIndex,
                  columnIndex: input.columnIndex,
                },
                insertRight: input.insertRight ?? false,
              },
            },
          ],
        },
        retries: 3,
      });

      const result = BatchUpdateResponseSchema.safeParse(response.data);
      if (!result.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response from Google Docs API',
          details: result.error.issues,
        });
      }

      return {
        documentId: result.data.documentId,
      };
    },
  });
}
