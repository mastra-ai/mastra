// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteFooterInputSchema = z.object({
  documentId: z
    .string()
    .describe(
      'The ID of the document to delete the footer from. Example: "1ctrF7XM2lZqmQeOBjGXi0SrUY6jgyKwYhDMq5S6omZQ"',
    ),
  footerId: z.string().describe('The ID of the footer to delete. Example: "kix.910kf3z0ydqh"'),
  tabId: z
    .string()
    .optional()
    .describe('The tab that contains the footer to delete. When omitted, applies to the first tab.'),
});

const BatchUpdateResponseSchema = z.object({
  documentId: z.string().optional(),
  replies: z.array(z.unknown()).optional(),
});

export const deleteFooterOutputSchema = z.object({
  documentId: z.string(),
  success: z.boolean(),
});

export function deleteFooterTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_delete_footer',
    description: 'Delete a footer by footer ID.',
    inputSchema: deleteFooterInputSchema,
    outputSchema: deleteFooterOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteFooterOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              deleteFooter: {
                footerId: input.footerId,
                ...(input.tabId !== undefined && { tabId: input.tabId }),
              },
            },
          ],
        },
        retries: 3,
      });

      const parsed = BatchUpdateResponseSchema.parse(response.data);

      return {
        documentId: parsed.documentId || input.documentId,
        success: true,
      };
    },
  });
}
