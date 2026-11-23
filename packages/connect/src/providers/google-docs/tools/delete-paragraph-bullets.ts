// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const RangeSchema = z.object({
  startIndex: z.number().describe('The start index of the range (inclusive). Example: 153'),
  endIndex: z.number().describe('The end index of the range (exclusive). Example: 199'),
  segmentId: z
    .string()
    .optional()
    .describe('The segment ID. Omit or use empty string for the body segment. Example: ""'),
});

export const deleteParagraphBulletsInputSchema = z.object({
  documentId: z
    .string()
    .describe('The ID of the document to update. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  range: RangeSchema.describe('The range of paragraphs to remove bullets from.'),
});

export const deleteParagraphBulletsOutputSchema = z.object({
  documentId: z.string(),
  success: z.boolean(),
});

export function deleteParagraphBulletsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_delete_paragraph_bullets',
    description: 'Remove bullets or numbering from paragraphs in a range.',
    inputSchema: deleteParagraphBulletsInputSchema,
    outputSchema: deleteParagraphBulletsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteParagraphBulletsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const documentId = input.documentId;
      const range = input.range;

      // https://developers.google.com/docs/api/reference/rest/v1/documents/request#deleteparagraphbullets
      await platformProxy.post({
        endpoint: `/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              deleteParagraphBullets: {
                range: {
                  startIndex: range.startIndex,
                  endIndex: range.endIndex,
                  ...(range.segmentId !== undefined && { segmentId: range.segmentId }),
                },
              },
            },
          ],
        },
        retries: 3,
      });

      return {
        documentId,
        success: true,
      };
    },
  });
}
