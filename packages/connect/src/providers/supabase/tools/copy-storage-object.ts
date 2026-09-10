// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const copyStorageObjectInputSchema = z.object({
  bucketId: z.string().describe('Source bucket ID. Example: "nango-test-public"'),
  sourceKey: z.string().describe('Path of the source object within the bucket. Example: "docs/readme.txt"'),
  destinationBucket: z.string().describe('Destination bucket ID. Example: "nango-test-public"'),
  destinationKey: z
    .string()
    .describe('Path for the copied object in the destination bucket. Example: "docs/readme-copy.txt"'),
});

const ProviderMetadataSchema = z.object({
  cacheControl: z.string().optional(),
  contentLength: z.number().optional(),
  httpStatusCode: z.number().optional(),
  eTag: z.string().optional(),
  lastModified: z.string().optional(),
  mimetype: z.string().optional(),
  size: z.number().optional(),
});

const ProviderObjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  bucket_id: z.string(),
  owner: z.string().optional(),
  metadata: ProviderMetadataSchema.optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  last_accessed_at: z.string().optional(),
});

export const copyStorageObjectOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  bucket_id: z.string(),
  owner: z.string().optional(),
  size: z.number().optional(),
  metadata: ProviderMetadataSchema.optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  last_accessed_at: z.string().optional(),
});

export function copyStorageObjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_copy_storage_object',
    description: 'Copy a storage object within or between buckets in Supabase.',
    inputSchema: copyStorageObjectInputSchema,
    outputSchema: copyStorageObjectOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof copyStorageObjectOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfig = z
        .object({ projectUrl: z.string().optional() })
        .passthrough()
        .nullish()
        .parse(connection?.connection_config);
      const projectUrl = connectionConfig?.['projectUrl'];
      const baseUrlOverride =
        typeof projectUrl === 'string'
          ? projectUrl.startsWith('http')
            ? projectUrl
            : `https://${projectUrl}`
          : undefined;

      // https://supabase.com/docs/reference/javascript/storage-from-copy
      const response = await platformProxy.post({
        endpoint: '/storage/v1/object/copy',
        baseUrlOverride,
        data: {
          bucketId: input.bucketId,
          sourceKey: input.sourceKey,
          destinationBucket: input.destinationBucket,
          destinationKey: input.destinationKey,
        },
        retries: 3,
      });

      const providerObject = ProviderObjectSchema.parse(response.data);

      return {
        id: providerObject.id,
        name: providerObject.name,
        bucket_id: providerObject.bucket_id,
        ...(providerObject.owner !== undefined && { owner: providerObject.owner }),
        ...(providerObject.metadata !== undefined && {
          size: providerObject.metadata.size,
          metadata: providerObject.metadata,
        }),
        ...(providerObject.created_at !== undefined && { created_at: providerObject.created_at }),
        ...(providerObject.updated_at !== undefined && { updated_at: providerObject.updated_at }),
        ...(providerObject.last_accessed_at !== undefined && { last_accessed_at: providerObject.last_accessed_at }),
      };
    },
  });
}
