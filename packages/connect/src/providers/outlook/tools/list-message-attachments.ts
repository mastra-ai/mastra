// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listMessageAttachmentsInputSchema = z.object({
  messageId: z
    .string()
    .describe('The unique identifier of the message to list attachments for. Example: "AAMkAGVmMD..."'),
});

const ProviderAttachmentSchema = z.object({
  id: z.string(),
  lastModifiedDateTime: z.string().optional(),
  name: z.string().optional(),
  contentType: z.string().optional(),
  size: z.number().optional(),
  isInline: z.boolean().optional(),
  contentId: z.string().optional(),
  contentLocation: z.string().optional(),
});

const OutputSchema = z.object({
  id: z.string(),
  lastModifiedDateTime: z.string().optional(),
  name: z.string().optional(),
  contentType: z.string().optional(),
  size: z.number().optional(),
  isInline: z.boolean().optional(),
  contentId: z.string().optional(),
  contentLocation: z.string().optional(),
});

export const listMessageAttachmentsOutputSchema = z.object({
  attachments: z.array(OutputSchema),
});

export function listMessageAttachmentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_list_message_attachments',
    description: 'List attachments on a message.',
    inputSchema: listMessageAttachmentsInputSchema,
    outputSchema: listMessageAttachmentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listMessageAttachmentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/message-list-attachments
      const response = await platformProxy.get({
        endpoint: `/v1.0/me/messages/${encodeURIComponent(input.messageId)}/attachments`,
        params: {
          $select: 'id,lastModifiedDateTime,name,contentType,size,isInline',
        },
        retries: 3,
      });

      const attachmentsData = response.data?.value || [];

      const attachments = attachmentsData.map((attachment: z.infer<typeof ProviderAttachmentSchema>) => {
        const parsed = ProviderAttachmentSchema.parse(attachment);
        return {
          id: parsed.id,
          ...(parsed.lastModifiedDateTime !== undefined && {
            lastModifiedDateTime: parsed.lastModifiedDateTime,
          }),
          ...(parsed.name !== undefined && { name: parsed.name }),
          ...(parsed.contentType !== undefined && {
            contentType: parsed.contentType,
          }),
          ...(parsed.size !== undefined && { size: parsed.size }),
          ...(parsed.isInline !== undefined && {
            isInline: parsed.isInline,
          }),
          ...(parsed.contentId !== undefined && {
            contentId: parsed.contentId,
          }),
          ...(parsed.contentLocation !== undefined && {
            contentLocation: parsed.contentLocation,
          }),
        };
      });

      return {
        attachments,
      };
    },
  });
}
