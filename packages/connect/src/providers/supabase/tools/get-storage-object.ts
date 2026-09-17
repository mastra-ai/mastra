// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getStorageObjectInputSchema = z.object({
  bucketId: z.string().describe('Storage bucket ID. Example: "nango-test-public"'),
  path: z.string().describe('Object path within the bucket. Example: "docs/readme.txt"'),
});

const ProviderMetadataSchema = z.object({
  size: z.number().optional(),
  mimetype: z.string().optional(),
});

const ProviderListItemSchema = z
  .object({
    name: z.string(),
    id: z.string().nullable(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    metadata: ProviderMetadataSchema.optional(),
  })
  .passthrough();

export const getStorageObjectOutputSchema = z.object({
  name: z.string(),
  id: z.string(),
  size: z.number(),
  contentType: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const ConnectionConfigSchema = z.object({
  projectUrl: z.string().optional(),
});

export function getStorageObjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_get_storage_object',
    description: 'Retrieve metadata for a single storage object from Supabase.',
    inputSchema: getStorageObjectInputSchema,
    outputSchema: getStorageObjectOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getStorageObjectOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const config = ConnectionConfigSchema.safeParse(connection.connection_config);
      const projectUrl = config.success ? config.data.projectUrl : undefined;
      const baseUrlOverride = projectUrl
        ? projectUrl.startsWith('http')
          ? projectUrl
          : `https://${projectUrl}`
        : undefined;

      if (!baseUrlOverride) {
        throw new platformProxy.ActionError({
          type: 'invalid_connection',
          message: 'projectUrl is missing in connection configuration.',
        });
      }

      const lastSlashIndex = input.path.lastIndexOf('/');
      const folderPrefix = lastSlashIndex >= 0 ? input.path.substring(0, lastSlashIndex + 1) : '';
      const fileName = lastSlashIndex >= 0 ? input.path.substring(lastSlashIndex + 1) : input.path;

      if (fileName.length === 0) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'The path must include a file name, not just a folder.',
        });
      }

      // https://supabase.com/docs/reference/api/storage-listobjects
      const pageSize = 100;
      let offset = 0;
      let match: z.infer<typeof ProviderListItemSchema> | undefined;

      while (!match) {
        const response = await platformProxy.post({
          endpoint: `/storage/v1/object/list/${encodeURIComponent(input.bucketId)}`,
          data: {
            prefix: folderPrefix,
            limit: pageSize,
            offset,
          },
          retries: 3,
          baseUrlOverride,
        });

        const items = z.array(ProviderListItemSchema).safeParse(response.data);
        if (!items.success) {
          throw new platformProxy.ActionError({
            type: 'provider_error',
            message: 'Unexpected response format from the storage list API.',
          });
        }

        match = items.data.find(item => item.name === fileName);

        if (!match && items.data.length < pageSize) {
          break;
        }

        offset += pageSize;
      }

      if (match === undefined) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Storage object not found in bucket "${input.bucketId}" at path "${input.path}".`,
        });
      }

      if (match.id === null) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `The path "${input.path}" in bucket "${input.bucketId}" refers to a folder, not a file object.`,
        });
      }

      const size = match.metadata?.size ?? 0;
      const contentType = match.metadata?.mimetype ?? 'application/octet-stream';
      const createdAt = match.created_at ?? '';
      const updatedAt = match.updated_at ?? '';

      return {
        name: match.name,
        id: match.id,
        size,
        contentType,
        created_at: createdAt,
        updated_at: updatedAt,
      };
    },
  });
}
