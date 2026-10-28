// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const addMessageAttachmentInputSchema = z.object({
  messageId: z.string().describe('The ID of the draft message to attach the file to. Example: "AQMkAGFk..."'),
  fileName: z.string().describe('The name of the file to attach. Example: "document.pdf"'),
  contentType: z.string().describe('The MIME type of the file. Example: "application/pdf"'),
  contentBytes: z.string().describe('The base64-encoded content of the file. Example: "JVBERi0xLjQK..."'),
});

const ProviderAttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  contentType: z.string().optional(),
  size: z.number().optional(),
  lastModifiedDateTime: z.string().optional(),
  contentId: z.string().nullable().optional(),
  contentLocation: z.string().nullable().optional(),
  isInline: z.boolean().optional(),
});

export const addMessageAttachmentOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  contentType: z.string().optional(),
  size: z.number().optional(),
});

export function addMessageAttachmentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_add_message_attachment',
    description: 'Attach a file to a draft message. Note: 3 MB simple upload limit applies.',
    inputSchema: addMessageAttachmentInputSchema,
    outputSchema: addMessageAttachmentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof addMessageAttachmentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://learn.microsoft.com/graph/api/message-post-attachments
        endpoint: `/v1.0/me/messages/${encodeURIComponent(input.messageId)}/attachments`,
        data: {
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: input.fileName,
          contentType: input.contentType,
          contentBytes: input.contentBytes,
        },
        retries: 3,
      });

      const providerAttachment = ProviderAttachmentSchema.parse(response.data);

      return {
        id: providerAttachment.id,
        name: providerAttachment.name,
        ...(providerAttachment.contentType !== undefined && { contentType: providerAttachment.contentType }),
        ...(providerAttachment.size !== undefined && { size: providerAttachment.size }),
      };
    },
  });
}
