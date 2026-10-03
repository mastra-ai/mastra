// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const replaceNamedRangeContentInputSchema = z.object({
  document_id: z.string().describe('Google Docs document ID. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  named_range_id: z.string().describe('Named range ID to replace content in. Example: "kix.ppfiu2m5lqas"'),
  text: z.string().describe('Replacement text to insert into the named range.'),
});

const ProviderBatchUpdateResponseSchema = z.object({
  documentId: z.string().optional(),
  replies: z
    .array(
      z.object({
        replaceNamedRangeContent: z.object({}).optional(),
      }),
    )
    .optional(),
  writeControl: z
    .object({
      requiredRevisionId: z.string().optional(),
    })
    .optional(),
});

export const replaceNamedRangeContentOutputSchema = z.object({
  document_id: z.string(),
  named_range_id: z.string(),
  replaced: z.boolean(),
  revision_id: z.string().optional(),
});

export function replaceNamedRangeContentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_replace_named_range_content',
    description: 'Replace the contents of a named range in a Google Doc.',
    inputSchema: replaceNamedRangeContentInputSchema,
    outputSchema: replaceNamedRangeContentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof replaceNamedRangeContentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
      const response = await platformProxy.post({
        endpoint: `/v1/documents/${encodeURIComponent(input.document_id)}:batchUpdate`,
        data: {
          requests: [
            {
              replaceNamedRangeContent: {
                namedRangeId: input.named_range_id,
                text: input.text,
              },
            },
          ],
        },
        retries: 3,
      });

      const batchResponse = ProviderBatchUpdateResponseSchema.parse(response.data);

      return {
        document_id: input.document_id,
        named_range_id: input.named_range_id,
        replaced: true,
        ...(batchResponse.writeControl?.requiredRevisionId != null && {
          revision_id: batchResponse.writeControl.requiredRevisionId,
        }),
      };
    },
  });
}
