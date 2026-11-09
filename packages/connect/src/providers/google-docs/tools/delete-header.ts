// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const deleteHeaderInputSchema = z.object({
  documentId: z.string().describe('Google Docs document ID. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  headerId: z.string().describe('Header ID to delete. Example: "kix.oq93zh93nzrf"'),
});

const BatchUpdateResponseSchema = z.object({
  documentId: z.string().optional(),
  replies: z.array(z.unknown()).optional(),
});

export const deleteHeaderOutputSchema = z.object({
  documentId: z.string(),
  headerId: z.string(),
  success: z.boolean(),
});

export function deleteHeaderTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_delete_header',
    description: 'Delete a header by header ID.',
    inputSchema: deleteHeaderInputSchema,
    outputSchema: deleteHeaderOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteHeaderOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
        endpoint: `v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              deleteHeader: {
                headerId: input.headerId,
              },
            },
          ],
        },
        retries: 3,
      };

      const response = await platformProxy.post(config);
      const parsedResponse = BatchUpdateResponseSchema.parse(response.data);

      return {
        documentId: parsedResponse.documentId || input.documentId,
        headerId: input.headerId,
        success: true,
      };
    },
  });
}
