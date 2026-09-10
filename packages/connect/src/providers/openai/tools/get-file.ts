// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getFileInputSchema = z.object({
  file_id: z.string().describe('The ID of the file to retrieve. Example: "file-123"'),
});

const ProviderFileSchema = z.object({
  id: z.string(),
  filename: z.string(),
  purpose: z.string(),
  bytes: z.number(),
  created_at: z.number(),
  status: z.string(),
});

export const getFileOutputSchema = z.object({
  id: z.string(),
  filename: z.string(),
  purpose: z.string(),
  bytes: z.number(),
  created_at: z.number(),
  status: z.string(),
});

export function getFileTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_get_file',
    description: 'Retrieve a single file metadata from OpenAI',
    inputSchema: getFileInputSchema,
    outputSchema: getFileOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getFileOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // @allowTryCatch - Handle 404 not found errors explicitly as expected failure case
      try {
        // https://platform.openai.com/docs/api-reference/files/get
        const response = await platformProxy.get({
          endpoint: `/v1/files/${encodeURIComponent(input.file_id)}`,
          retries: 3,
        });

        const providerFile = ProviderFileSchema.parse(response.data);

        return {
          id: providerFile.id,
          filename: providerFile.filename,
          purpose: providerFile.purpose,
          bytes: providerFile.bytes,
          created_at: providerFile.created_at,
          status: providerFile.status,
        };
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'status' in error &&
          error.status === 404 &&
          'payload' in error &&
          error.payload &&
          typeof error.payload === 'object' &&
          'error' in error.payload &&
          error.payload.error &&
          typeof error.payload.error === 'object' &&
          'message' in error.payload.error &&
          typeof error.payload.error.message === 'string'
        ) {
          throw new platformProxy.ActionError({
            type: 'not_found',
            message: error.payload.error.message,
            file_id: input.file_id,
          });
        }
        if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
          throw new platformProxy.ActionError({
            type: 'not_found',
            message: `File not found: ${input.file_id}`,
            file_id: input.file_id,
          });
        }
        throw error;
      }
    },
  });
}
