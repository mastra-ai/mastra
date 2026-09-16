// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createStorageObjectInputSchema = z.object({
  bucket_id: z.string().describe('The bucket ID. Example: "nango-test-public"'),
  path: z.string().describe('The object path within the bucket. Example: "docs/readme.txt"'),
  content: z
    .string()
    .describe('The file content as a string. For binary files, base64-encode and decode before sending.'),
  content_type: z.string().describe('The MIME type of the file. Example: "text/plain"'),
  upsert: z.boolean().optional().describe('If true, overwrite an existing object with the same path.'),
});

const ProviderResponseSchema = z.object({
  Key: z.string(),
  Id: z.string(),
});

export const createStorageObjectOutputSchema = z.object({
  key: z.string(),
  id: z.string(),
});

export function createStorageObjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_create_storage_object',
    description: 'Upload a storage object to Supabase Storage.',
    inputSchema: createStorageObjectInputSchema,
    outputSchema: createStorageObjectOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createStorageObjectOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfig = connection.connection_config;
      const projectUrl =
        connectionConfig !== null &&
        typeof connectionConfig === 'object' &&
        'projectUrl' in connectionConfig &&
        typeof connectionConfig['projectUrl'] === 'string'
          ? connectionConfig['projectUrl']
          : undefined;
      const baseUrlOverride = projectUrl
        ? projectUrl.startsWith('http')
          ? projectUrl
          : `https://${projectUrl}`
        : undefined;

      const response = await platformProxy.post({
        // https://supabase.com/docs/reference/api/storage
        endpoint: `/storage/v1/object/${encodeURIComponent(input.bucket_id)}/${encodeURIComponent(input.path)}`,
        baseUrlOverride,
        data: input.content,
        headers: {
          'Content-Type': input.content_type,
          ...(input.upsert && { 'x-upsert': 'true' }),
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        key: providerResponse.Key,
        id: providerResponse.Id,
      };
    },
  });
}
