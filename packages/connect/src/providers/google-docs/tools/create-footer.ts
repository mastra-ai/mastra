// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createFooterInputSchema = z.object({
  documentId: z.string().describe('Google Docs document ID. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  text: z.string().optional().describe('Optional text to insert into the newly created footer.'),
  sectionBreakIndex: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Index of the section break in the document body. Defaults to 0 for the first section.'),
});

const BatchUpdateResponseSchema = z.object({
  documentId: z.string(),
  replies: z.array(
    z.object({
      createFooter: z
        .object({
          footerId: z.string(),
        })
        .optional(),
    }),
  ),
});

export const createFooterOutputSchema = z.object({
  documentId: z.string(),
  footerId: z.string(),
  textInserted: z.boolean().optional(),
});

export function createFooterTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_create_footer',
    description: 'Create a footer in a document section',
    inputSchema: createFooterInputSchema,
    outputSchema: createFooterOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createFooterOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const documentId = input.documentId;
      const sectionBreakIndex = input.sectionBreakIndex ?? 0;

      // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
      const createResponse = await platformProxy.post({
        endpoint: `/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              createFooter: {
                sectionBreakLocation: {
                  index: sectionBreakIndex,
                  segmentId: '',
                },
                type: 'DEFAULT',
              },
            },
          ],
        },
        retries: 3,
      });

      const createResult = BatchUpdateResponseSchema.parse(createResponse.data);
      const reply = createResult.replies[0];
      const footerId = reply?.createFooter?.footerId;

      if (!footerId) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'Failed to create footer: no footerId returned',
        });
      }

      let textInserted = false;

      if (input.text && input.text.length > 0) {
        // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
        await platformProxy.post({
          endpoint: `/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
          data: {
            requests: [
              {
                insertText: {
                  text: input.text,
                  endOfSegmentLocation: {
                    segmentId: footerId,
                  },
                },
              },
            ],
          },
          retries: 3,
        });
        textInserted = true;
      }

      return {
        documentId: createResult.documentId,
        footerId,
        ...(textInserted && { textInserted }),
      };
    },
  });
}
