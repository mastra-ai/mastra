// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteKnowledgeBaseDocumentInputSchema = z.object({
  documentation_id: z
    .string()
    .describe(
      'The id of a document from the knowledge base. This is returned on document addition. Example: "21m00Tcm4TlvDq8ikWAM"',
    ),
  force: z
    .boolean()
    .optional()
    .describe('If set to true, the document or folder will be deleted regardless of whether it is used by any agents.'),
});

export const deleteKnowledgeBaseDocumentOutputSchema = z.object({}).passthrough();

export function deleteKnowledgeBaseDocumentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_delete_knowledge_base_document',
    description: 'Delete a knowledge base document.',
    inputSchema: deleteKnowledgeBaseDocumentInputSchema,
    outputSchema: deleteKnowledgeBaseDocumentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteKnowledgeBaseDocumentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.delete({
        // https://elevenlabs.io/docs/api-reference/knowledge-base/delete
        endpoint: `/v1/convai/knowledge-base/${encodeURIComponent(input.documentation_id)}`,
        params: {
          ...(input.force !== undefined && { force: String(input.force) }),
        },
        retries: 3,
      });

      const data = response.data;
      if (data === '' || data === null || data === undefined || typeof data !== 'object') {
        return {};
      }

      return deleteKnowledgeBaseDocumentOutputSchema.parse(data);
    },
  });
}
