// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const insertPageBreakInputSchema = z.object({
  documentId: z.string().describe('Google Docs document ID. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  index: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      'Zero-based body index where the page break should be inserted. If omitted, the page break is inserted at the end of the document body.',
    ),
});

export const insertPageBreakOutputSchema = z.object({
  documentId: z.string(),
  inserted: z.boolean(),
});

export function insertPageBreakTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_insert_page_break',
    description: 'Insert a page break in the document body.',
    inputSchema: insertPageBreakInputSchema,
    outputSchema: insertPageBreakOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof insertPageBreakOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: {
        requests: Array<{
          insertPageBreak: {
            location?: {
              index: number;
              segmentId: string;
            };
            endOfSegmentLocation?: {
              segmentId: string;
            };
          };
        }>;
      } = {
        requests: [],
      };

      if (input.index !== undefined) {
        requestBody.requests.push({
          insertPageBreak: {
            location: {
              index: input.index,
              segmentId: '',
            },
          },
        });
      } else {
        requestBody.requests.push({
          insertPageBreak: {
            endOfSegmentLocation: {
              segmentId: '',
            },
          },
        });
      }

      // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
      await platformProxy.post({
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: requestBody,
        retries: 3,
      });

      return {
        documentId: input.documentId,
        inserted: true,
      };
    },
  });
}
