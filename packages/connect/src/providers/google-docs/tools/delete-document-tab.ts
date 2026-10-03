// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const deleteDocumentTabInputSchema = z.object({
  documentId: z.string().describe('Google Docs document ID. Example: "1rG_Aj6JXSnTeaHzE0CoIOAYtPdrwRKbilw54N0WQU34"'),
  tabId: z.string().describe('Tab ID to delete. Example: "t.r7sklz35b6u5"'),
});

const BatchUpdateResponseSchema = z.object({
  documentId: z.string().optional(),
  replies: z.array(z.unknown()).optional(),
});

export const deleteDocumentTabOutputSchema = z.object({
  documentId: z.string(),
  tabId: z.string(),
});

export function deleteDocumentTabTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_delete_document_tab',
    description: 'Delete a document tab by tab ID.',
    inputSchema: deleteDocumentTabInputSchema,
    outputSchema: deleteDocumentTabOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteDocumentTabOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              deleteTab: {
                tabId: input.tabId,
              },
            },
          ],
        },
        retries: 3,
      };

      const response = await platformProxy.post(config);

      const providerResponse = BatchUpdateResponseSchema.parse(response.data);

      return {
        documentId: providerResponse.documentId || input.documentId,
        tabId: input.tabId,
      };
    },
  });
}
