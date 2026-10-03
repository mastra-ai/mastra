// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteTableRowInputSchema = z.object({
  documentId: z.string(),
  tableStartIndex: z.number().int().nonnegative(),
  rowIndex: z.number().int().nonnegative(),
  columnIndex: z.number().int().nonnegative(),
  tabId: z.string().optional(),
  segmentId: z.string().optional(),
});

const BatchUpdateResponseSchema = z.object({
  documentId: z.string().optional(),
  replies: z.array(z.unknown()).optional(),
});

export const deleteTableRowOutputSchema = z.object({
  documentId: z.string().optional(),
  replies: z.array(z.unknown()).optional(),
});

export function deleteTableRowTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_delete_table_row',
    description: 'Delete a table row using a reference cell.',
    inputSchema: deleteTableRowInputSchema,
    outputSchema: deleteTableRowOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteTableRowOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const tableStartLocation: Record<string, unknown> = {
        index: input.tableStartIndex,
        segmentId: input.segmentId ?? '',
      };
      if (input.tabId !== undefined) {
        tableStartLocation['tabId'] = input.tabId;
      }

      const requestBody = {
        requests: [
          {
            deleteTableRow: {
              tableCellLocation: {
                tableStartLocation,
                rowIndex: input.rowIndex,
                columnIndex: input.columnIndex,
              },
            },
          },
        ],
      };

      const response = await platformProxy.post({
        // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: requestBody,
        retries: 3,
      });

      const providerResponse = BatchUpdateResponseSchema.parse(response.data);

      return {
        documentId: providerResponse.documentId,
        replies: providerResponse.replies,
      };
    },
  });
}
