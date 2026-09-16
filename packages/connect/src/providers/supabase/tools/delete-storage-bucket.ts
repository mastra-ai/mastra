// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteStorageBucketInputSchema = z.object({
  bucket_id: z.string().describe('Storage bucket ID to delete. Example: "nango-del-bucket-1"'),
});

const ListObjectSchema = z.object({
  name: z.string(),
  id: z.string().nullable().optional(),
});

export const deleteStorageBucketOutputSchema = z.object({
  success: z.boolean(),
  bucket_id: z.string(),
});

const ConnectionConfigSchema = z.object({
  projectUrl: z.string(),
});

export function deleteStorageBucketTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_delete_storage_bucket',
    description: 'Delete or archive a storage bucket in Supabase.',
    inputSchema: deleteStorageBucketInputSchema,
    outputSchema: deleteStorageBucketOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteStorageBucketOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfig = ConnectionConfigSchema.safeParse(connection.connection_config);
      const projectUrl = connectionConfig.success ? connectionConfig.data.projectUrl : undefined;
      const baseUrlOverride =
        typeof projectUrl === 'string'
          ? projectUrl.startsWith('http')
            ? projectUrl
            : `https://${projectUrl}`
          : undefined;

      const bucketId = input.bucket_id;

      // List and delete all objects in the bucket (including nested folders) before deletion.
      // Supabase requires the bucket to be empty. We traverse the prefix tree and always
      // re-list from offset 0 after each delete batch since deleting shrinks the listing.
      const limit = 1000;
      const prefixQueue: string[] = [''];

      const queuedPrefixes = new Set<string>(['']);

      while (prefixQueue.length > 0) {
        const prefix = prefixQueue[0]!;

        // Keep listing from offset 0: after each delete the same prefix has fewer items.
        while (true) {
          const listResponse = await platformProxy.post({
            // https://supabase.com/docs/reference/api/storage-list-objects
            endpoint: `/storage/v1/object/list/${encodeURIComponent(bucketId)}`,
            data: {
              limit,
              offset: 0,
              prefix,
            },
            baseUrlOverride,
            retries: 3,
          });

          const objects = z.array(ListObjectSchema).parse(listResponse.data || []);
          if (objects.length === 0) {
            break;
          }

          const files = objects.filter(obj => obj.id != null);
          const folders = objects.filter(obj => obj.id == null);

          for (const folder of folders) {
            const folderName = folder.name.endsWith('/') ? folder.name.slice(0, -1) : folder.name;
            const subPrefix = prefix ? `${prefix}${folderName}/` : `${folderName}/`;
            if (!queuedPrefixes.has(subPrefix)) {
              queuedPrefixes.add(subPrefix);
              prefixQueue.push(subPrefix);
            }
          }

          if (files.length > 0) {
            const prefixes = files.map(obj => (prefix ? `${prefix}${obj.name}` : obj.name));

            await platformProxy.delete({
              // https://supabase.com/docs/reference/api/storage-delete-objects
              endpoint: `/storage/v1/object/${encodeURIComponent(bucketId)}`,
              data: { prefixes },
              baseUrlOverride,
              retries: 3,
            });
          }

          if (objects.length < limit) {
            break;
          }
        }

        prefixQueue.shift();
      }

      await platformProxy.delete({
        // https://supabase.com/docs/reference/api/storage-delete-bucket
        endpoint: `/storage/v1/bucket/${encodeURIComponent(bucketId)}`,
        baseUrlOverride,
        retries: 3,
      });

      return {
        success: true,
        bucket_id: bucketId,
      };
    },
  });
}
