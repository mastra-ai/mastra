// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listStorageObjectsInputSchema = z.object({
  bucket_id: z.string().describe('Storage bucket ID. Example: "nango-test-public"'),
  prefix: z.string().optional().describe('Folder path prefix to filter objects. Example: "docs/"'),
  limit: z.number().int().min(1).max(1000).optional().describe('Maximum number of objects to return. Default: 100'),
  offset: z.number().int().min(0).optional().describe('Offset for pagination. Default: 0'),
});

const ProviderMetadataSchema = z
  .object({
    eTag: z.string().optional(),
    size: z.number().optional(),
    mimetype: z.string().optional(),
    cacheControl: z.string().optional(),
  })
  .passthrough();

const ProviderObjectSchema = z
  .object({
    name: z.string(),
    id: z.string().nullable().optional(),
    bucket_id: z.string().nullable().optional(),
    owner: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    last_accessed_at: z.string().nullable().optional(),
    metadata: ProviderMetadataSchema.nullable().optional(),
  })
  .passthrough();

export const listStorageObjectsOutputSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      id: z.string().optional(),
      bucket_id: z.string().optional(),
      owner: z.string().optional(),
      updated_at: z.string().optional(),
      created_at: z.string().optional(),
      last_accessed_at: z.string().optional(),
      metadata: z
        .object({
          eTag: z.string().optional(),
          size: z.number().optional(),
          mimetype: z.string().optional(),
          cacheControl: z.string().optional(),
        })
        .optional(),
    }),
  ),
  next_offset: z.number().optional().describe('Offset to use for the next page of results.'),
});

export function listStorageObjectsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_list_storage_objects',
    description: 'List storage objects from Supabase.',
    inputSchema: listStorageObjectsInputSchema,
    outputSchema: listStorageObjectsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listStorageObjectsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const rawConfig = connection.connection_config;
      const projectUrl =
        rawConfig &&
        typeof rawConfig === 'object' &&
        'projectUrl' in rawConfig &&
        typeof rawConfig['projectUrl'] === 'string'
          ? rawConfig['projectUrl']
          : undefined;
      const baseUrlOverride = projectUrl
        ? projectUrl.startsWith('http')
          ? projectUrl
          : `https://${projectUrl}`
        : undefined;

      const limit = input.limit ?? 100;
      const offset = input.offset ?? 0;

      // https://supabase.com/docs/reference/api/storage
      const response = await platformProxy.post({
        endpoint: `/storage/v1/object/list/${encodeURIComponent(input.bucket_id)}`,
        baseUrlOverride,
        data: {
          limit,
          offset,
          prefix: input.prefix ?? '',
        },
        retries: 3,
      });

      const providerObjects = z.array(ProviderObjectSchema).parse(response.data);

      const items = providerObjects.map(obj => ({
        name: obj.name,
        ...(obj.id !== undefined && obj.id !== null && { id: obj.id }),
        ...(obj.bucket_id !== undefined && obj.bucket_id !== null && { bucket_id: obj.bucket_id }),
        ...(obj.owner !== undefined && obj.owner !== null && { owner: obj.owner }),
        ...(obj.updated_at !== undefined && obj.updated_at !== null && { updated_at: obj.updated_at }),
        ...(obj.created_at !== undefined && obj.created_at !== null && { created_at: obj.created_at }),
        ...(obj.last_accessed_at !== undefined &&
          obj.last_accessed_at !== null && { last_accessed_at: obj.last_accessed_at }),
        ...(obj.metadata !== undefined &&
          obj.metadata !== null && {
            metadata: {
              ...(obj.metadata.eTag !== undefined && obj.metadata.eTag !== null && { eTag: obj.metadata.eTag }),
              ...(obj.metadata.size !== undefined && obj.metadata.size !== null && { size: obj.metadata.size }),
              ...(obj.metadata.mimetype !== undefined &&
                obj.metadata.mimetype !== null && { mimetype: obj.metadata.mimetype }),
              ...(obj.metadata.cacheControl !== undefined &&
                obj.metadata.cacheControl !== null && { cacheControl: obj.metadata.cacheControl }),
            },
          }),
      }));

      const nextOffset = providerObjects.length === limit ? offset + limit : undefined;

      return {
        items,
        ...(nextOffset !== undefined && { next_offset: nextOffset }),
      };
    },
  });
}
