// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getUploadUrlInputSchema = z.object({
  filename: z.string().describe('Name of the file being uploaded. Example: "document.pdf"'),
  length: z.number().int().min(1).describe('Size of the file in bytes. Example: 1024'),
  alt_txt: z.string().optional().describe('Description of image for screen-reader. Only applicable for image files.'),
});

export const getUploadUrlOutputSchema = z.object({
  upload_url: z.string().describe('The URL to upload the file content to'),
  file_id: z.string().describe('The unique file ID for this upload'),
});

export function getUploadUrlTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_get_upload_url',
    description: 'Generate an external upload URL and file ID for Slack uploads',
    inputSchema: getUploadUrlInputSchema,
    outputSchema: getUploadUrlOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getUploadUrlOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {
        filename: input.filename,
        length: input.length,
      };

      if (input['alt_txt']) {
        params['alt_txt'] = input['alt_txt'];
      }

      const response = await platformProxy.post({
        // https://api.slack.com/methods/files.getUploadURLExternal
        endpoint: 'files.getUploadURLExternal',
        params,
        retries: 3,
      });

      if (!response.data.ok) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: response.data.error || 'Failed to get upload URL',
          slack_error: response.data.error,
        });
      }

      return {
        upload_url: response.data.upload_url,
        file_id: response.data.file_id,
      };
    },
  });
}
