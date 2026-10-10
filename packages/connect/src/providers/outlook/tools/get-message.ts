// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getMessageInputSchema = z.object({
  messageId: z.string().describe('The unique identifier of the message. Example: "AAMkAGVmMD..."'),
  expandAttachments: z.boolean().optional().describe('If true, expands the attachments relationship in the response.'),
});

const EmailAddressSchema = z.object({
  address: z.string().optional(),
  name: z.string().optional(),
});

const RecipientSchema = z.object({
  emailAddress: EmailAddressSchema.optional(),
});

const AttachmentSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  contentType: z.string().optional(),
  size: z.number().optional(),
});

const ProviderMessageSchema = z.object({
  id: z.string(),
  subject: z.string().nullable().optional(),
  bodyPreview: z.string().nullable().optional(),
  createdDateTime: z.string().optional(),
  receivedDateTime: z.string().optional(),
  sentDateTime: z.string().optional(),
  importance: z.string().optional(),
  isRead: z.boolean().optional(),
  isDraft: z.boolean().optional(),
  from: RecipientSchema.nullable().optional(),
  toRecipients: z.array(RecipientSchema).optional(),
  ccRecipients: z.array(RecipientSchema).optional(),
  bccRecipients: z.array(RecipientSchema).optional(),
  replyTo: z.array(RecipientSchema).optional(),
  attachments: z.array(AttachmentSchema).optional(),
});

export const getMessageOutputSchema = z.object({
  id: z.string(),
  subject: z.string().optional(),
  bodyPreview: z.string().optional(),
  createdDateTime: z.string().optional(),
  receivedDateTime: z.string().optional(),
  sentDateTime: z.string().optional(),
  importance: z.string().optional(),
  isRead: z.boolean().optional(),
  isDraft: z.boolean().optional(),
  from: RecipientSchema.optional(),
  toRecipients: z.array(RecipientSchema).optional(),
  ccRecipients: z.array(RecipientSchema).optional(),
  bccRecipients: z.array(RecipientSchema).optional(),
  replyTo: z.array(RecipientSchema).optional(),
  attachments: z.array(AttachmentSchema).optional(),
});

export function getMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_get_message',
    description: 'Retrieve a message by ID.',
    inputSchema: getMessageInputSchema,
    outputSchema: getMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};

      if (input.expandAttachments) {
        params['$expand'] = 'attachments';
      }

      // https://learn.microsoft.com/graph/api/message-get
      const response = await platformProxy.get({
        endpoint: `/v1.0/me/messages/${encodeURIComponent(input.messageId)}`,
        params,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Message not found',
          messageId: input.messageId,
        });
      }

      const message = ProviderMessageSchema.parse(response.data);

      return {
        id: message.id,
        ...(message.subject != null && { subject: message.subject }),
        ...(message.bodyPreview != null && { bodyPreview: message.bodyPreview }),
        ...(message.createdDateTime !== undefined && { createdDateTime: message.createdDateTime }),
        ...(message.receivedDateTime !== undefined && { receivedDateTime: message.receivedDateTime }),
        ...(message.sentDateTime !== undefined && { sentDateTime: message.sentDateTime }),
        ...(message.importance !== undefined && { importance: message.importance }),
        ...(message.isRead !== undefined && { isRead: message.isRead }),
        ...(message.isDraft !== undefined && { isDraft: message.isDraft }),
        ...(message.from !== undefined && message.from !== null && { from: message.from }),
        ...(message.toRecipients !== undefined && { toRecipients: message.toRecipients }),
        ...(message.ccRecipients !== undefined && { ccRecipients: message.ccRecipients }),
        ...(message.bccRecipients !== undefined && { bccRecipients: message.bccRecipients }),
        ...(message.replyTo !== undefined && { replyTo: message.replyTo }),
        ...(message.attachments !== undefined && { attachments: message.attachments }),
      };
    },
  });
}
