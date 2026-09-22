// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteFileInputSchema = z.object({
  file_id: z.string().describe('ID of the File to delete. Example: "file_011CNha8iCJcU1wXNR6q4V8w"'),
});

const ProviderDeletedFileSchema = z.object({
  id: z.string(),
  type: z.literal('file_deleted').optional(),
});

export const deleteFileOutputSchema = z.object({
  id: z.string(),
  type: z.literal('file_deleted').optional(),
});

export function deleteFileTool(proxy: PlatformProxy) {
  return createTool({
    id: 'anthropic_delete_file',
    description: 'Delete or archive a file in Anthropic.',
    inputSchema: deleteFileInputSchema,
    outputSchema: deleteFileOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteFileOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.delete({
        // https://docs.anthropic.com/en/api/files-delete
        endpoint: `/v1/files/${encodeURIComponent(input.file_id)}`,
        headers: {
          'anthropic-beta': 'files-api-2025-04-14',
        },
        retries: 3,
      });

      const deletedFile = ProviderDeletedFileSchema.parse(response.data);

      return {
        id: deletedFile.id,
        ...(deletedFile.type !== undefined && { type: deletedFile.type }),
      };
    },
  });
}
