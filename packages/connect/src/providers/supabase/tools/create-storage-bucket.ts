// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createStorageBucketInputSchema = z.object({
  id: z.string().describe('Unique identifier for the bucket. Example: "my-bucket"'),
  name: z.string().optional().describe('Display name for the bucket. Defaults to id if omitted.'),
  public: z.boolean().optional().describe('Whether the bucket is publicly accessible. Defaults to false.'),
  file_size_limit: z.number().optional().describe('Maximum file size in bytes. Example: 10485760'),
  allowed_mime_types: z
    .array(z.string())
    .optional()
    .describe('Allowed MIME types. Example: ["image/png", "image/jpeg"]'),
  type: z.enum(['STANDARD', 'ANALYTICS']).optional().describe('Bucket type. Defaults to STANDARD.'),
});

const ProviderBucketSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  public: z.boolean().optional(),
  owner: z.string().optional(),
  owner_id: z.string().optional(),
  file_size_limit: z.number().nullable().optional(),
  allowed_mime_types: z.array(z.string()).nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  type: z.enum(['STANDARD', 'ANALYTICS']).optional(),
});

export const createStorageBucketOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  public: z.boolean(),
  owner: z.string().optional(),
  owner_id: z.string().optional(),
  file_size_limit: z.number().optional(),
  allowed_mime_types: z.array(z.string()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  type: z.enum(['STANDARD', 'ANALYTICS']).optional(),
});

const ConnectionConfigSchema = z.object({
  projectUrl: z.string().optional(),
});

export function createStorageBucketTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_create_storage_bucket',
    description: 'Create a storage bucket in Supabase.',
    inputSchema: createStorageBucketInputSchema,
    outputSchema: createStorageBucketOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createStorageBucketOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const configResult = ConnectionConfigSchema.safeParse(connection.connection_config);
      const projectUrl = configResult.success ? configResult.data.projectUrl : undefined;
      const baseUrlOverride = projectUrl
        ? projectUrl.startsWith('http')
          ? projectUrl
          : `https://${projectUrl}`
        : undefined;

      const response = await platformProxy.post({
        // https://supabase.com/docs/reference/api/storage-create-bucket
        endpoint: '/storage/v1/bucket',
        baseUrlOverride,
        data: {
          id: input.id,
          name: input.name ?? input.id,
          public: input.public ?? false,
          ...(input.type !== undefined && { type: input.type }),
          ...(input.file_size_limit !== undefined && { file_size_limit: input.file_size_limit }),
          ...(input.allowed_mime_types !== undefined && { allowed_mime_types: input.allowed_mime_types }),
        },
        retries: 1,
      });

      const providerBucket = ProviderBucketSchema.parse(response.data);

      return {
        id: providerBucket.id ?? input.id,
        name: providerBucket.name,
        public: providerBucket.public ?? input.public ?? false,
        ...(providerBucket.owner !== undefined && { owner: providerBucket.owner }),
        ...(providerBucket.owner_id !== undefined && { owner_id: providerBucket.owner_id }),
        ...(providerBucket.file_size_limit != null && { file_size_limit: providerBucket.file_size_limit }),
        ...(providerBucket.allowed_mime_types != null && { allowed_mime_types: providerBucket.allowed_mime_types }),
        ...(providerBucket.created_at !== undefined && { created_at: providerBucket.created_at }),
        ...(providerBucket.updated_at !== undefined && { updated_at: providerBucket.updated_at }),
        ...(providerBucket.type !== undefined && { type: providerBucket.type }),
      };
    },
  });
}
