// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateStorageBucketInputSchema = z.object({
  id: z.string().describe('Bucket ID. Example: "nango-test-public"'),
  public: z.boolean().optional().describe('Whether the bucket is publicly accessible'),
  fileSizeLimit: z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .describe('Maximum file size in bytes or as a string like "100MB"'),
  allowedMimeTypes: z
    .array(z.string())
    .nullable()
    .optional()
    .describe('Allowed MIME types. Example: ["image/png", "image/jpg"]'),
});

const ProviderResponseSchema = z.object({
  message: z.string(),
});

export const updateStorageBucketOutputSchema = z.object({
  message: z.string(),
});

export function updateStorageBucketTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_update_storage_bucket',
    description: 'Update a storage bucket in Supabase.',
    inputSchema: updateStorageBucketInputSchema,
    outputSchema: updateStorageBucketOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateStorageBucketOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfig = connection.connection_config;
      let projectUrl: unknown;
      if (typeof connectionConfig === 'object' && connectionConfig !== null && 'projectUrl' in connectionConfig) {
        projectUrl = connectionConfig['projectUrl'];
      }
      const baseUrlOverride =
        typeof projectUrl === 'string'
          ? projectUrl.startsWith('http')
            ? projectUrl
            : `https://${projectUrl}`
          : undefined;

      const data: Record<string, unknown> = {};
      if (input.public !== undefined) {
        data['public'] = input.public;
      }
      if (input.fileSizeLimit !== undefined) {
        data['file_size_limit'] = input.fileSizeLimit;
      }
      if (input.allowedMimeTypes !== undefined) {
        data['allowed_mime_types'] = input.allowedMimeTypes;
      }

      if (Object.keys(data).length === 0) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'At least one field to update must be provided.',
        });
      }

      const response = await platformProxy.put({
        // https://supabase.com/docs/reference/api
        endpoint: `/storage/v1/bucket/${encodeURIComponent(input.id)}`,
        data,
        baseUrlOverride,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        message: providerResponse.message,
      };
    },
  });
}
