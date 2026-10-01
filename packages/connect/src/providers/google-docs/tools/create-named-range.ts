// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createNamedRangeInputSchema = z.object({
  documentId: z.string().describe('Google Docs document ID. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  name: z.string().describe('Name for the new named range. Example: "my-range"'),
  startIndex: z.number().int().describe('Start index of the range (inclusive).'),
  endIndex: z.number().int().describe('End index of the range (exclusive).'),
});

export const createNamedRangeOutputSchema = z.object({
  namedRangeId: z.string().describe('The ID of the newly created named range.'),
});

const BatchUpdateResponseSchema = z.object({
  replies: z.array(
    z.object({
      createNamedRange: z
        .object({
          namedRangeId: z.string(),
        })
        .optional(),
    }),
  ),
});

export function createNamedRangeTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_create_named_range',
    description: 'Create a named range over a text range.',
    inputSchema: createNamedRangeInputSchema,
    outputSchema: createNamedRangeOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createNamedRangeOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              createNamedRange: {
                name: input.name,
                range: {
                  segmentId: '',
                  startIndex: input.startIndex,
                  endIndex: input.endIndex,
                },
              },
            },
          ],
        },
        retries: 3,
      });

      const batchResponse = BatchUpdateResponseSchema.parse(response.data);

      const firstReply = batchResponse.replies[0];
      if (!firstReply || !firstReply.createNamedRange) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'Failed to create named range: unexpected response structure',
        });
      }

      return {
        namedRangeId: firstReply.createNamedRange.namedRangeId,
      };
    },
  });
}
