// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getFileInputSchema = z.object({
  file_id: z.string().describe('The ID of the file to retrieve. Example: "file_01HqW8Kq0Z2Q2W8Kq0Z2Q2W8"'),
});

const ScopeSchema = z.object({
  id: z.string(),
  type: z.literal('session'),
});

export const getFileOutputSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  filename: z.string(),
  mime_type: z.string(),
  size_bytes: z.number(),
  type: z.literal('file'),
  downloadable: z.boolean().optional(),
  scope: ScopeSchema.nullable().optional(),
});

export function getFileTool(proxy: PlatformProxy) {
  return createTool({
    id: 'anthropic_get_file',
    description: 'Retrieve a single file from Anthropic.',
    inputSchema: getFileInputSchema,
    outputSchema: getFileOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getFileOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.anthropic.com/en/api/files
        endpoint: `/v1/files/${encodeURIComponent(input.file_id)}`,
        headers: {
          'anthropic-beta': 'files-api-2025-04-14',
        },
        retries: 3,
      });

      const file = getFileOutputSchema.parse(response.data);

      return file;
    },
  });
}
