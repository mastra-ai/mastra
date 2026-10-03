// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createDocumentInputSchema = z.object({
  title: z.string().describe('Title for the new Google Doc. Example: "Meeting Notes"'),
});

const ProviderDocumentSchema = z.object({
  documentId: z.string(),
  revisionId: z.string(),
});

export const createDocumentOutputSchema = z.object({
  documentId: z.string(),
  revisionId: z.string(),
});

export function createDocumentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_create_document',
    description: 'Create a blank Google Doc with a title',
    inputSchema: createDocumentInputSchema,
    outputSchema: createDocumentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createDocumentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://developers.google.com/docs/api/reference/rest/v1/documents/create
        endpoint: '/v1/documents',
        data: {
          title: input.title,
        },
        retries: 3,
      });

      const providerDoc = ProviderDocumentSchema.parse(response.data);

      return {
        documentId: providerDoc.documentId,
        revisionId: providerDoc.revisionId,
      };
    },
  });
}
