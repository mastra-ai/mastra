// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getAttachmentInputSchema = z.object({
  messageId: z.string().describe('The ID of the message containing the attachment. Example: "1234567890abcdef"'),
  attachmentId: z.string().describe('The ID of the attachment to retrieve. Example: "attachment_001"'),
  userId: z.string().optional().describe('The user\'s email address or "me". Defaults to "me".'),
});

const ProviderAttachmentSchema = z.object({
  size: z.number(),
  data: z.string(),
});

export const getAttachmentOutputSchema = z.object({
  size: z.number().describe('The size of the attachment in bytes'),
  data: z.string().describe('The attachment data in base64url encoding'),
});

export function getAttachmentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_get_attachment',
    description: 'Retrieve a specific message attachment payload by attachment ID.',
    inputSchema: getAttachmentInputSchema,
    outputSchema: getAttachmentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getAttachmentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const userId = input.userId || 'me';
      const { messageId, attachmentId } = input;

      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages.attachments/get
      const response = await platformProxy.get({
        endpoint: `/gmail/v1/users/${encodeURIComponent(userId)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Attachment not found',
          messageId,
          attachmentId,
        });
      }

      const providerAttachment = ProviderAttachmentSchema.parse(response.data);

      return {
        size: providerAttachment.size,
        data: providerAttachment.data,
      };
    },
  });
}
