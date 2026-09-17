// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createSignedUrlInputSchema = z.object({
  bucket_id: z.string().describe('Storage bucket ID. Example: "nango-test-private"'),
  path: z.string().describe('Object path within the bucket. Example: "data/sample.txt"'),
  expires_in: z.number().int().positive().optional().describe('Expiry time in seconds. Defaults to 3600.'),
});

export const createSignedUrlOutputSchema = z.object({
  signed_url: z.string().describe('Absolute URL for accessing the object.'),
});

const ProviderBucketSchema = z.object({
  public: z.boolean(),
});

const ProviderSignResponseSchema = z.object({
  signedURL: z.string(),
});

const ConnectionConfigSchema = z.object({
  projectUrl: z.string().optional(),
});

const MetadataSchema = z.object({
  projectUrl: z.string().optional(),
});

export function createSignedUrlTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_create_signed_url',
    description: 'Generate a time-limited signed URL for accessing a private storage object.',
    inputSchema: createSignedUrlInputSchema,
    outputSchema: createSignedUrlOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createSignedUrlOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const configParse = ConnectionConfigSchema.safeParse(connection.connection_config);
      let projectUrl = configParse.success ? configParse.data.projectUrl : undefined;

      if (!projectUrl) {
        const metadata = await platformProxy.getMetadata();
        const metadataParse = MetadataSchema.safeParse(metadata);
        projectUrl = metadataParse.success ? metadataParse.data.projectUrl : undefined;
      }

      if (!projectUrl) {
        throw new platformProxy.ActionError({
          type: 'missing_project_url',
          message: 'projectUrl is required in connection_config or metadata.',
        });
      }

      const normalizedProjectUrl = projectUrl.startsWith('http') ? projectUrl : `https://${projectUrl}`;
      const baseUrlOverride = normalizedProjectUrl;

      // https://supabase.com/docs/reference/api/storage-get-bucket
      const bucketResponse = await platformProxy.get({
        endpoint: `/storage/v1/bucket/${encodeURIComponent(input.bucket_id)}`,
        retries: 3,
        baseUrlOverride,
      });

      const bucket = ProviderBucketSchema.parse(bucketResponse.data);

      if (bucket.public) {
        const publicUrl = `${normalizedProjectUrl}/storage/v1/object/public/${encodeURIComponent(input.bucket_id)}/${encodeURIComponent(input.path)}`;
        return {
          signed_url: publicUrl,
        };
      }

      const expiresIn = input.expires_in ?? 3600;

      // https://supabase.com/docs/reference/api/storage-create-signed-url
      const signResponse = await platformProxy.post({
        endpoint: `/storage/v1/object/sign/${encodeURIComponent(input.bucket_id)}/${encodeURIComponent(input.path)}`,
        data: {
          expiresIn,
        },
        retries: 3,
        baseUrlOverride,
      });

      const signData = ProviderSignResponseSchema.parse(signResponse.data);
      const signedUrl = `${normalizedProjectUrl}/storage/v1${signData.signedURL}`;

      return {
        signed_url: signedUrl,
      };
    },
  });
}
