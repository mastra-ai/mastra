// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getStorageBucketInputSchema = z.object({
  bucketId: z.string().describe('Storage bucket ID. Example: "nango-test-public"'),
});

const ProviderBucketSchema = z.object({
  id: z.string(),
  name: z.string(),
  owner: z.string().optional(),
  owner_id: z.string().optional(),
  public: z.boolean(),
  type: z.enum(['STANDARD', 'ANALYTICS']).optional(),
  file_size_limit: z.number().nullable().optional(),
  allowed_mime_types: z.array(z.string()).nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const getStorageBucketOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  owner: z.string().optional(),
  owner_id: z.string().optional(),
  public: z.boolean(),
  type: z.enum(['STANDARD', 'ANALYTICS']).optional(),
  file_size_limit: z.number().nullable().optional(),
  allowed_mime_types: z.array(z.string()).nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export function getStorageBucketTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_get_storage_bucket',
    description: 'Retrieve a single storage bucket from Supabase.',
    inputSchema: getStorageBucketInputSchema,
    outputSchema: getStorageBucketOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getStorageBucketOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfigSchema = z.object({
        projectUrl: z.string().optional(),
      });
      const connectionConfig = connectionConfigSchema.parse(connection.connection_config || {});
      const projectUrl = connectionConfig.projectUrl;
      const baseUrlOverride = projectUrl
        ? projectUrl.startsWith('http')
          ? projectUrl
          : `https://${projectUrl}`
        : undefined;

      const response = await platformProxy.get({
        // https://supabase.com/docs/reference/api
        endpoint: `/storage/v1/bucket/${encodeURIComponent(input.bucketId)}`,
        baseUrlOverride,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Bucket not found: ${input.bucketId}`,
        });
      }

      const bucket = ProviderBucketSchema.parse(response.data);

      return {
        id: bucket.id,
        name: bucket.name,
        ...(bucket.owner !== undefined && { owner: bucket.owner }),
        ...(bucket.owner_id !== undefined && { owner_id: bucket.owner_id }),
        public: bucket.public,
        ...(bucket.type !== undefined && { type: bucket.type }),
        ...(bucket.file_size_limit !== undefined && { file_size_limit: bucket.file_size_limit }),
        ...(bucket.allowed_mime_types !== undefined && { allowed_mime_types: bucket.allowed_mime_types }),
        ...(bucket.created_at !== undefined && { created_at: bucket.created_at }),
        ...(bucket.updated_at !== undefined && { updated_at: bucket.updated_at }),
      };
    },
  });
}
