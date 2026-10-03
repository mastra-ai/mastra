// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const pinTableHeaderRowsInputSchema = z.object({
  documentId: z
    .string()
    .describe('The ID of the document containing the table. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  tableStartLocation: z
    .number()
    .int()
    .min(0)
    .describe('The index of the table element in the document body. Example: 211'),
  pinnedHeaderRowsCount: z
    .number()
    .int()
    .min(0)
    .describe('The number of rows to pin as header rows. Use 0 to unpin. Example: 1'),
});

const PinTableHeaderRowsReplySchema = z.object({}).passthrough();

const BatchUpdateResponseSchema = z
  .object({
    replies: z.array(PinTableHeaderRowsReplySchema).optional(),
    documentId: z.string().optional(),
    revisionId: z.string().optional(),
  })
  .passthrough();

export const pinTableHeaderRowsOutputSchema = z.object({
  documentId: z.string(),
  revisionId: z.string().optional(),
  replies: z.array(PinTableHeaderRowsReplySchema).optional(),
});

export function pinTableHeaderRowsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_pin_table_header_rows',
    description: 'Pin or unpin a number of rows as frozen headers in a table.',
    inputSchema: pinTableHeaderRowsInputSchema,
    outputSchema: pinTableHeaderRowsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof pinTableHeaderRowsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              pinTableHeaderRows: {
                tableStartLocation: {
                  index: input.tableStartLocation,
                },
                pinnedHeaderRowsCount: input.pinnedHeaderRowsCount,
              },
            },
          ],
        },
        retries: 3,
      });

      const parsed = BatchUpdateResponseSchema.parse(response.data);

      if (!parsed.documentId) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'Provider response did not include a documentId.',
        });
      }

      return {
        documentId: parsed.documentId,
        ...(parsed.revisionId !== undefined && { revisionId: parsed.revisionId }),
        ...(parsed.replies !== undefined && { replies: parsed.replies }),
      };
    },
  });
}
