// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const uploadDocumentInputSchema = z.object({
  name: z.string().describe('The name of the file to create. Example: "document.txt"'),
  content: z.string().describe('The file content as plain text or base64 encoded string'),
  mimeType: z.string().describe('The MIME type of the file. Example: "text/plain", "application/pdf"'),
  isBase64: z.boolean().optional().describe('Whether the content is base64 encoded. Defaults to false'),
  folderId: z
    .string()
    .optional()
    .describe(
      'The ID of the folder to upload the file into. If not provided, defaults to root. Example: "1a2b3c4d5e6f7g8h"',
    ),
  description: z.string().optional().describe('A description of the file'),
});

export const uploadDocumentOutputSchema = z.object({
  id: z.string().describe('The ID of the created file'),
  name: z.string().describe('The name of the created file'),
  mimeType: z.string().describe('The MIME type of the file'),
  webViewLink: z.string().optional().describe('A link for opening the file in a relevant Google editor or viewer'),
  webContentLink: z.string().optional().describe('A link for downloading the content of the file in a browser'),
});

export function uploadDocumentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_upload_document',
    description:
      'Upload plain text or base64 file content up to 5 MB, optionally into a folder with a description; defaults to root',
    inputSchema: uploadDocumentInputSchema,
    outputSchema: uploadDocumentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof uploadDocumentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Decode base64 content if needed
      let fileContent: string;
      if (input.isBase64) {
        fileContent = Buffer.from(input.content, 'base64').toString('binary');
      } else {
        fileContent = input.content;
      }

      // Step 1: Create file metadata
      // https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create
      const metadataBody: Record<string, unknown> = {
        name: input.name,
        mimeType: input.mimeType,
      };

      if (input.description) {
        metadataBody['description'] = input.description;
      }

      if (input.folderId) {
        metadataBody['parents'] = [input.folderId];
      }

      const createResponse = await platformProxy.post({
        endpoint: '/drive/v3/files',
        params: {
          fields: 'id,name,mimeType,webViewLink,webContentLink',
        },
        data: metadataBody,
        retries: 3,
      });

      if (!createResponse.data || !createResponse.data.id) {
        throw new platformProxy.ActionError({
          type: 'create_failed',
          message: 'Failed to create file metadata in Google Drive',
        });
      }

      const fileId = createResponse.data.id;

      // Step 2: Upload content using media upload
      // https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update
      //
      // Step 1 already created the file, so a definite rejection here (4xx — bad request,
      // quota, too large) strands an empty file that a caller retry would then duplicate:
      // roll the creation back (best-effort — a failed cleanup must not mask the original
      // error) and rethrow. On an ambiguous failure (network error, timeout, 5xx) the
      // content may already have been applied, so the file is left in place rather than
      // risk deleting a successful upload.
      let contentResponse;
      try {
        contentResponse = await platformProxy.patch({
          endpoint: `/upload/drive/v3/files/${fileId}`,
          params: {
            uploadType: 'media',
            fields: 'id,name,mimeType,webViewLink,webContentLink',
          },
          headers: {
            'Content-Type': input.mimeType,
          },
          data: fileContent,
          retries: 3,
        });
      } catch (error: any) {
        const status = error?.response?.status;
        if (typeof status === 'number' && status >= 400 && status < 500) {
          await platformProxy
            .delete({
              endpoint: `/drive/v3/files/${fileId}`,
              retries: 3,
            })
            .catch(() => undefined);
        }

        throw error;
      }

      if (!contentResponse.data) {
        throw new platformProxy.ActionError({
          type: 'upload_failed',
          message: 'Failed to upload file content to Google Drive',
        });
      }

      const file = contentResponse.data;

      return {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        webViewLink: file.webViewLink ?? undefined,
        webContentLink: file.webContentLink ?? undefined,
      };
    },
  });
}
