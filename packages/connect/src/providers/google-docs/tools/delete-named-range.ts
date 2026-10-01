// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteNamedRangeInputSchema = z.object({
  documentId: z
    .string()
    .describe(
      'The ID of the document containing the named range. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"',
    ),
  namedRangeId: z
    .string()
    .optional()
    .describe(
      'The ID of the named range to delete. Either namedRangeId or name must be provided. Example: "kix.ppfiu2m5lqas"',
    ),
  name: z
    .string()
    .optional()
    .describe(
      'The name of the named range to delete. Either namedRangeId or name must be provided. Example: "nango-test-range"',
    ),
  tabId: z.string().optional().describe('The tab ID to scope the deletion to. Example: "t.0"'),
});

const BatchUpdateResponseSchema = z.object({
  documentId: z.string(),
  replies: z.array(z.unknown()).optional(),
});

export const deleteNamedRangeOutputSchema = z.object({
  success: z.boolean(),
  documentId: z.string(),
});

export function deleteNamedRangeTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_delete_named_range',
    description: 'Delete a named range by ID or by name.',
    inputSchema: deleteNamedRangeInputSchema,
    outputSchema: deleteNamedRangeOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteNamedRangeOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if (!input.namedRangeId && !input.name) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'Either namedRangeId or name must be provided.',
        });
      }

      const deleteNamedRangeRequest: Record<string, unknown> = {};
      if (input.namedRangeId !== undefined) {
        deleteNamedRangeRequest['namedRangeId'] = input.namedRangeId;
      }
      if (input.name !== undefined) {
        deleteNamedRangeRequest['name'] = input.name;
      }
      if (input.tabId !== undefined) {
        deleteNamedRangeRequest['tabsCriteria'] = { tabIds: [input.tabId] };
      }

      // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
      const response = await platformProxy.post({
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              deleteNamedRange: deleteNamedRangeRequest,
            },
          ],
        },
        retries: 3,
      });

      const batchResponse = BatchUpdateResponseSchema.parse(response.data);

      return {
        success: true,
        documentId: batchResponse.documentId,
      };
    },
  });
}
