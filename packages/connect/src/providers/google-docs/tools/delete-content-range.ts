// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteContentRangeInputSchema = z.object({
  documentId: z.string().describe('Google Docs document ID. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  startIndex: z.number().int().nonnegative().describe('Inclusive start index of the range to delete.'),
  endIndex: z.number().int().nonnegative().describe('Exclusive end index of the range to delete.'),
  segmentId: z
    .string()
    .optional()
    .describe(
      'Segment ID to delete from. Use the headerId or footerId for headers/footers; omit or use "" for the body.',
    ),
});

const BatchUpdateReplySchema = z.record(z.string(), z.unknown());

const ProviderResponseSchema = z.object({
  documentId: z.string(),
  replies: z.array(BatchUpdateReplySchema).optional(),
  writeControl: z.record(z.string(), z.unknown()).optional(),
});

export const deleteContentRangeOutputSchema = z.object({
  documentId: z.string(),
  replies: z.array(z.record(z.string(), z.unknown())),
  writeControl: z.record(z.string(), z.unknown()).optional(),
});

export function deleteContentRangeTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_delete_content_range',
    description:
      'Delete text or other removable content from a range in a Google Doc. The range must be structurally valid: it cannot span table cells, section breaks, or the final newline of a segment (body, header, or footer).',
    inputSchema: deleteContentRangeInputSchema,
    outputSchema: deleteContentRangeOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteContentRangeOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if (input.endIndex <= input.startIndex) {
        throw new platformProxy.ActionError({
          type: 'invalid_range',
          message: 'endIndex must be greater than startIndex.',
        });
      }

      const response = await platformProxy.post({
        // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              deleteContentRange: {
                range: {
                  segmentId: input.segmentId ?? '',
                  startIndex: input.startIndex,
                  endIndex: input.endIndex,
                },
              },
            },
          ],
        },
        retries: 3,
      });

      const parsed = ProviderResponseSchema.parse(response.data);

      return {
        documentId: parsed.documentId,
        replies: parsed.replies ?? [],
        ...(parsed.writeControl !== undefined && { writeControl: parsed.writeControl }),
      };
    },
  });
}
