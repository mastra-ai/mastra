// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const DimensionSchema = z.object({
  magnitude: z.number(),
  unit: z.string(),
});

const LocationSchema = z.object({
  index: z.number(),
  tabId: z.string().optional(),
  segmentId: z.string().optional(),
});

const TableRowStyleSchema = z.object({
  minRowHeight: DimensionSchema.optional(),
  preventOverflow: z.boolean().optional(),
  tableHeader: z.boolean().optional(),
});

export const updateTableRowStyleInputSchema = z.object({
  documentId: z
    .string()
    .describe('The ID of the document to update. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  tableStartLocation: LocationSchema.describe('The location where the table starts in the document.'),
  rowIndices: z
    .array(z.number())
    .optional()
    .describe('Zero-based row indices to update. If omitted, all rows are updated.'),
  tableRowStyle: TableRowStyleSchema.describe('The row style properties to apply.'),
  fields: z
    .string()
    .describe('Field mask for the row style update. Use "*" for all fields or specific fields like "minRowHeight".'),
});

export const updateTableRowStyleOutputSchema = z.object({
  documentId: z.string(),
  replies: z.array(z.record(z.string(), z.unknown())).optional(),
  writeControl: z
    .object({
      requiredRevisionId: z.string().optional(),
    })
    .optional(),
});

export function updateTableRowStyleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_update_table_row_style',
    description: 'Update minimum height or related row styling for table rows.',
    inputSchema: updateTableRowStyleInputSchema,
    outputSchema: updateTableRowStyleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateTableRowStyleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody = {
        requests: [
          {
            updateTableRowStyle: {
              tableStartLocation: {
                index: input.tableStartLocation.index,
                ...(input.tableStartLocation.tabId !== undefined && { tabId: input.tableStartLocation.tabId }),
                ...(input.tableStartLocation.segmentId !== undefined && {
                  segmentId: input.tableStartLocation.segmentId,
                }),
              },
              ...(input.rowIndices !== undefined && { rowIndices: input.rowIndices }),
              tableRowStyle: {
                ...(input.tableRowStyle.minRowHeight !== undefined && {
                  minRowHeight: input.tableRowStyle.minRowHeight,
                }),
                ...(input.tableRowStyle.preventOverflow !== undefined && {
                  preventOverflow: input.tableRowStyle.preventOverflow,
                }),
                ...(input.tableRowStyle.tableHeader !== undefined && { tableHeader: input.tableRowStyle.tableHeader }),
              },
              fields: input.fields,
            },
          },
        ],
      };

      // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
      const response = await platformProxy.post({
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: requestBody,
        retries: 3,
      });

      const parsed = updateTableRowStyleOutputSchema.parse(response.data);
      return parsed;
    },
  });
}
