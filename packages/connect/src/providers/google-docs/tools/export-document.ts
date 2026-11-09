// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const exportDocumentInputSchema = z.object({
  fileId: z
    .string()
    .describe('The ID of the Google Doc file to export. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  mimeType: z
    .enum([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/html',
      'text/plain',
    ])
    .describe('The target MIME type for the export.'),
});

export const exportDocumentOutputSchema = z.object({
  fileId: z.string(),
  mimeType: z.string(),
  data: z.string().describe('The exported document encoded as a base64 string.'),
  size: z.number().describe('The size of the exported data in bytes.'),
});

export function exportDocumentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_export_document',
    description: 'Export a Google Doc to PDF, DOCX, HTML, or plain text.',
    inputSchema: exportDocumentInputSchema,
    outputSchema: exportDocumentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof exportDocumentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export
        endpoint: '/drive/v3/files/' + encodeURIComponent(input.fileId) + '/export',
        baseUrlOverride: 'https://www.googleapis.com',
        params: {
          mimeType: input.mimeType,
        },
        responseType: 'arraybuffer',
        retries: 3,
      });

      const rawData = response.data;
      if (typeof rawData !== 'object' || rawData === null) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Expected binary response from export API.',
        });
      }

      const buffer = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData);

      return {
        fileId: input.fileId,
        mimeType: input.mimeType,
        data: buffer.toString('base64'),
        size: buffer.length,
      };
    },
  });
}
