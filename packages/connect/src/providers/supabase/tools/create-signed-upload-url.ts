// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createSignedUploadUrlInputSchema = z.object({
  bucket_id: z.string().describe('Storage bucket ID. Example: "nango-test-public"'),
  path: z.string().describe('Object path within the bucket. Example: "uploads/file.txt"'),
});

const ProviderResponseSchema = z.object({
  url: z.string(),
  token: z.string(),
});

export const createSignedUploadUrlOutputSchema = z.object({
  signed_url: z.string().describe('Absolute signed URL the client can PUT to.'),
  token: z.string().describe('Token included in the signed URL.'),
});

export function createSignedUploadUrlTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_create_signed_upload_url',
    description:
      'Generate a signed URL that allows a client to upload a file directly to Supabase Storage without exposing the service role key.',
    inputSchema: createSignedUploadUrlInputSchema,
    outputSchema: createSignedUploadUrlOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createSignedUploadUrlOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const rawProjectUrl = connection.connection_config?.['projectUrl'];
      const projectUrl =
        typeof rawProjectUrl === 'string' && rawProjectUrl.length > 0
          ? rawProjectUrl.startsWith('http')
            ? rawProjectUrl
            : `https://${rawProjectUrl}`
          : undefined;
      const baseUrlOverride = projectUrl;

      if (!baseUrlOverride) {
        throw new platformProxy.ActionError({
          type: 'missing_project_url',
          message: 'projectUrl is missing from connection configuration.',
        });
      }

      const response = await platformProxy.post({
        // https://supabase.com/docs/reference/api/storage-createuploadsignedurl
        endpoint: `/storage/v1/object/upload/sign/${encodeURIComponent(input.bucket_id)}/${encodeURIComponent(input.path)}`,
        data: {
          upsert: true,
        },
        baseUrlOverride,
        retries: 3,
      });

      const providerData = ProviderResponseSchema.parse(response.data);
      const signedUrl = `${baseUrlOverride}/storage/v1${providerData.url}`;

      return {
        signed_url: signedUrl,
        token: providerData.token,
      };
    },
  });
}
