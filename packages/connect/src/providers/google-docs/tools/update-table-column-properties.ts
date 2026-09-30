// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const updateTableColumnPropertiesInputSchema = z.object({
  documentId: z.string().describe('Google Docs document ID. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  tableStartLocation: z.object({
    index: z.number().describe('The zero-based index where the table starts in the document.'),
    segmentId: z
      .string()
      .optional()
      .describe('The ID of the header, footer or footnote. Empty or omitted signifies the document body.'),
    tabId: z.string().optional().describe('The tab that the location is in. When omitted, applies to the first tab.'),
  }),
  columnIndices: z
    .array(z.number())
    .describe('Zero-based column indices whose properties should be updated. If empty, all columns are updated.'),
  width: z.number().min(5).describe('The column width in points (PT). Must be at least 5 points.'),
  widthType: z
    .enum(['EVENLY_DISTRIBUTED', 'FIXED_WIDTH'])
    .optional()
    .describe('The width type of the column. Defaults to FIXED_WIDTH when width is provided.'),
  fields: z.string().optional().describe('The fields that should be updated. Defaults to "width,widthType".'),
});

const BatchUpdateResponseSchema = z.object({
  documentId: z.string(),
  replies: z.array(z.object({}).passthrough()).optional(),
  writeControl: z
    .object({
      requiredRevisionId: z.string().optional(),
      targetRevisionId: z.string().optional(),
    })
    .optional(),
});

export const updateTableColumnPropertiesOutputSchema = z.object({
  documentId: z.string(),
  replies: z.array(z.object({}).passthrough()).optional(),
});

export function updateTableColumnPropertiesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_update_table_column_properties',
    description: 'Update widths for one or more table columns.',
    inputSchema: updateTableColumnPropertiesInputSchema,
    outputSchema: updateTableColumnPropertiesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateTableColumnPropertiesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const widthType = input.widthType ?? 'FIXED_WIDTH';
      const fields = input.fields ?? 'width,widthType';

      const config: PlatformProxyRequest = {
        // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        method: 'POST',
        data: {
          requests: [
            {
              updateTableColumnProperties: {
                tableStartLocation: {
                  index: input.tableStartLocation.index,
                  ...(input.tableStartLocation.segmentId !== undefined && {
                    segmentId: input.tableStartLocation.segmentId,
                  }),
                  ...(input.tableStartLocation.tabId !== undefined && { tabId: input.tableStartLocation.tabId }),
                },
                columnIndices: input.columnIndices,
                tableColumnProperties: {
                  widthType,
                  width: {
                    magnitude: input.width,
                    unit: 'PT',
                  },
                },
                fields,
              },
            },
          ],
        },
        retries: 3,
      };

      const response = await platformProxy.proxy(config);
      const batchResponse = BatchUpdateResponseSchema.parse(response.data);

      return {
        documentId: batchResponse.documentId,
        replies: batchResponse.replies,
      };
    },
  });
}
