// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createUploadSessionInputSchema = z.object({
  parentItemId: z
    .string()
    .describe('The ID of the parent folder where the file will be uploaded. Example: "0123456789abc"'),
  fileName: z.string().describe('The name of the file to upload. Example: "document.pdf"'),
});

const ProviderUploadSessionSchema = z.object({
  uploadUrl: z.string(),
  expirationDateTime: z.string(),
  nextExpectedRanges: z.array(z.string()).optional(),
});

export const createUploadSessionOutputSchema = z.object({
  uploadUrl: z.string(),
  expirationDateTime: z.string(),
  nextExpectedRanges: z.array(z.string()).optional(),
});

export function createUploadSessionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'one_drive_create_upload_session',
    description: 'Start a resumable upload for a large file.',
    inputSchema: createUploadSessionInputSchema,
    outputSchema: createUploadSessionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createUploadSessionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/driveitem-createuploadsession
      const response = await platformProxy.post({
        endpoint: `/v1.0/me/drive/items/${encodeURIComponent(input.parentItemId)}:/${encodeURIComponent(input.fileName)}:/createUploadSession`,
        retries: 3,
      });

      const uploadSession = ProviderUploadSessionSchema.parse(response.data);

      return {
        uploadUrl: uploadSession.uploadUrl,
        expirationDateTime: uploadSession.expirationDateTime,
        ...(uploadSession.nextExpectedRanges !== undefined && {
          nextExpectedRanges: uploadSession.nextExpectedRanges,
        }),
      };
    },
  });
}
