// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateStorageObjectInputSchema = z
  .object({
    bucket_id: z.string().describe('The bucket ID containing the object. Example: "nango-test-public"'),
    path: z.string().describe('The current path of the object. Example: "docs/readme.txt"'),
    new_path: z
      .string()
      .optional()
      .describe('The new path for the object (to move/rename). Mutually exclusive with content.'),
    new_bucket_id: z
      .string()
      .optional()
      .describe('The destination bucket ID for moving. Defaults to the source bucket if not provided.'),
    content: z
      .string()
      .optional()
      .describe('New file content to overwrite the object. Use this for text files. Mutually exclusive with new_path.'),
    content_type: z
      .string()
      .optional()
      .describe('MIME type for the new content. Defaults to text/plain if content is provided.'),
  })
  .refine(
    data => {
      const hasMove = data.new_path !== undefined;
      const hasContent = data.content !== undefined;
      return hasMove !== hasContent;
    },
    {
      message: 'Must provide exactly one of new_path or content.',
    },
  );

const MoveResponseSchema = z
  .object({
    message: z.string(),
  })
  .passthrough();

const UploadResponseSchema = z
  .object({
    Id: z.string().optional(),
    Key: z.string().optional(),
  })
  .passthrough();

export const updateStorageObjectOutputSchema = z.object({
  message: z.string().optional(),
  id: z.string().optional(),
  path: z.string().optional(),
  full_path: z.string().optional(),
});

const ConnectionConfigSchema = z.object({
  projectUrl: z.string().optional(),
});

export function updateStorageObjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_update_storage_object',
    description: 'Update a storage object in Supabase.',
    inputSchema: updateStorageObjectInputSchema,
    outputSchema: updateStorageObjectOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateStorageObjectOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfig = ConnectionConfigSchema.parse(connection.connection_config || {});
      const baseUrlOverride = connectionConfig.projectUrl
        ? connectionConfig.projectUrl.startsWith('http')
          ? connectionConfig.projectUrl
          : `https://${connectionConfig.projectUrl}`
        : undefined;

      if (input.new_path !== undefined) {
        const response = await platformProxy.post({
          // https://supabase.com/docs/reference/api/storage-move
          endpoint: '/storage/v1/object/move',
          data: {
            bucketId: input.bucket_id,
            sourceKey: input.path,
            destinationBucket: input.new_bucket_id || input.bucket_id,
            destinationKey: input.new_path,
          },
          retries: 1,
          baseUrlOverride,
        });

        const moveData = MoveResponseSchema.parse(response.data);

        return {
          message: moveData.message,
        };
      }

      if (input.content !== undefined) {
        const response = await platformProxy.post({
          // https://supabase.com/docs/reference/api/storage-upload
          endpoint: `/storage/v1/object/${encodeURIComponent(input.bucket_id)}/${encodeURIComponent(input.path)}`,
          headers: {
            'x-upsert': 'true',
            'Content-Type': input.content_type || 'text/plain',
          },
          data: input.content,
          retries: 3,
          baseUrlOverride,
        });

        const uploadData = UploadResponseSchema.parse(response.data);

        return {
          id: uploadData.Id,
          full_path: uploadData.Key,
        };
      }

      throw new platformProxy.ActionError({
        type: 'invalid_input',
        message: 'Must provide either new_path or content.',
      });
    },
  });
}
