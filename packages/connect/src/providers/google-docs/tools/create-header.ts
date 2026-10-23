// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createHeaderInputSchema = z.object({
  documentId: z.string().describe('Google Docs document ID. Example: "1DLhzKGEHJyyDul07fu34aPrhaA5HOijCord1pNz79dQ"'),
  text: z.string().optional().describe('Optional text to insert into the newly created header.'),
});

const BatchUpdateResponseSchema = z.object({
  documentId: z.string(),
  replies: z.array(
    z.object({
      createHeader: z
        .object({
          headerId: z.string(),
        })
        .optional(),
    }),
  ),
});

export const createHeaderOutputSchema = z.object({
  documentId: z.string(),
  headerId: z.string(),
  textInserted: z.boolean(),
});

export function createHeaderTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_create_header',
    description: 'Create a header in a document section.',
    inputSchema: createHeaderInputSchema,
    outputSchema: createHeaderOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createHeaderOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
      const createResponse = await platformProxy.post({
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              createHeader: {
                type: 'DEFAULT',
              },
            },
          ],
        },
        retries: 3,
      });

      const batchResult = BatchUpdateResponseSchema.parse(createResponse.data);
      const reply = batchResult.replies[0];
      if (!reply?.createHeader?.headerId) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'Failed to create header: missing headerId in response.',
        });
      }

      const headerId = reply.createHeader.headerId;
      let textInserted = false;

      if (input.text) {
        // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
        await platformProxy.post({
          endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
          data: {
            requests: [
              {
                insertText: {
                  endOfSegmentLocation: {
                    segmentId: headerId,
                  },
                  text: input.text,
                },
              },
            ],
          },
          retries: 3,
        });
        textInserted = true;
      }

      return {
        documentId: input.documentId,
        headerId,
        textInserted,
      };
    },
  });
}
