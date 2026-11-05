// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

const MAX_CONTENT_BYTES = 250 * 1024 * 1024;

export const updateWordDocumentContentInputSchema = z.object({
  driveId: z
    .string()
    .describe(
      'The ID of the drive containing the document. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"',
    ),
  itemId: z
    .string()
    .describe('The ID of the Word document driveItem to update. Example: "01RFYLAYGCHWM67HNJIZBJNCQTFNXT6YGT"'),
  content: z
    .string()
    .min(1)
    .regex(BASE64_PATTERN, 'content must be non-empty, valid base64-encoded data')
    .describe(
      'Base64-encoded .docx file content to replace the existing document content. Must not exceed 250 MB decoded.',
    ),
});

const ProviderDriveItemSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  webUrl: z.string().nullish(),
  size: z.number().nullish(),
  lastModifiedDateTime: z.string().nullish(),
});

export const updateWordDocumentContentOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  webUrl: z.string().optional(),
  size: z.number().optional(),
  lastModifiedDateTime: z.string().optional(),
});

export function updateWordDocumentContentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_word_update_word_document_content',
    description: 'Replace the content of an existing Word document.',
    inputSchema: updateWordDocumentContentInputSchema,
    outputSchema: updateWordDocumentContentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateWordDocumentContentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const decodedContent = Buffer.from(input.content, 'base64');

      if (decodedContent.length === 0) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'content must decode to non-empty .docx file data',
        });
      }

      if (decodedContent.length > MAX_CONTENT_BYTES) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: `Decoded content is ${decodedContent.length} bytes, which exceeds the 250 MB limit supported by this endpoint.`,
        });
      }

      const config: PlatformProxyRequest = {
        // https://learn.microsoft.com/en-us/graph/api/driveitem-put-content
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/content`,
        data: decodedContent,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
        retries: 3,
      };

      const response = await platformProxy.put(config);

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Document not found or content update failed',
          driveId: input.driveId,
          itemId: input.itemId,
        });
      }

      const driveItem = ProviderDriveItemSchema.parse(response.data);

      return {
        id: driveItem.id,
        ...(driveItem.name != null && { name: driveItem.name }),
        ...(driveItem.webUrl != null && { webUrl: driveItem.webUrl }),
        ...(driveItem.size != null && { size: driveItem.size }),
        ...(driveItem.lastModifiedDateTime != null && { lastModifiedDateTime: driveItem.lastModifiedDateTime }),
      };
    },
  });
}
