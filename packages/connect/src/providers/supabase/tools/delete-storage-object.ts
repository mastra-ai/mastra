// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteStorageObjectInputSchema = z.object({
  bucketId: z.string().describe('Storage bucket ID. Example: "nango-test-public"'),
  prefixes: z.array(z.string()).min(1).describe('Object paths to delete. Example: ["delete-me-1.txt"]'),
});

const DeletedObjectSchema = z
  .object({
    name: z.string(),
    id: z.string().optional(),
    bucket_id: z.string().optional(),
    owner: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    last_accessed_at: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    path_tokens: z.array(z.string()).optional(),
    version: z.string().optional(),
  })
  .passthrough();

export const deleteStorageObjectOutputSchema = z.object({
  deleted: z.array(DeletedObjectSchema),
});

export function deleteStorageObjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_delete_storage_object',
    description: 'Delete or archive a storage object in Supabase.',
    inputSchema: deleteStorageObjectInputSchema,
    outputSchema: deleteStorageObjectOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteStorageObjectOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfig = connection.connection_config;
      const projectUrl =
        typeof connectionConfig === 'object' && connectionConfig !== null && 'projectUrl' in connectionConfig
          ? connectionConfig['projectUrl']
          : undefined;
      const baseUrlOverride =
        typeof projectUrl === 'string'
          ? projectUrl.startsWith('http')
            ? projectUrl
            : `https://${projectUrl}`
          : undefined;

      // https://supabase.com/docs/reference/api
      const response = await platformProxy.delete({
        endpoint: `/storage/v1/object/${encodeURIComponent(input.bucketId)}`,
        data: {
          prefixes: input.prefixes,
        },
        baseUrlOverride,
        retries: 3,
      });

      const parsed = z.array(DeletedObjectSchema).parse(response.data);

      return {
        deleted: parsed,
      };
    },
  });
}
