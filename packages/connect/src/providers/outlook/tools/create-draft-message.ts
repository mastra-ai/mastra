// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const EmailAddressSchema = z.object({
  address: z.string().describe('Email address. Example: "recipient@example.com"'),
  name: z.string().optional().describe('Display name. Example: "John Doe"'),
});

const RecipientSchema = z.object({
  emailAddress: EmailAddressSchema,
});

const BodySchema = z.object({
  contentType: z.enum(['text', 'html']).describe('Content type: "text" or "html"'),
  content: z.string().describe('Body content of the message'),
});

const BodySchemaWidened = z.object({
  contentType: z.enum(['text', 'html']).or(z.string()).describe('Content type: "text" or "html"'),
  content: z.string().describe('Body content of the message'),
});

export const createDraftMessageInputSchema = z.object({
  subject: z.string().describe('Subject of the message. Example: "Meeting notes"'),
  body: BodySchema.describe('Body of the message'),
  toRecipients: z.array(RecipientSchema).optional().describe('List of recipients to send the message to'),
  ccRecipients: z.array(RecipientSchema).optional().describe('List of CC recipients'),
  bccRecipients: z.array(RecipientSchema).optional().describe('List of BCC recipients'),
  importance: z.enum(['low', 'normal', 'high']).optional().describe('Importance level. Example: "normal"'),
  isReadReceiptRequested: z.boolean().optional().describe('Whether a read receipt was requested'),
  isDeliveryReceiptRequested: z.boolean().optional().describe('Whether a delivery receipt was requested'),
});

const ProviderMessageSchema = z
  .object({
    id: z.string(),
    subject: z.string().optional(),
    body: BodySchemaWidened.optional(),
    toRecipients: z.array(RecipientSchema).optional(),
    ccRecipients: z.array(RecipientSchema).optional(),
    bccRecipients: z.array(RecipientSchema).optional(),
    importance: z.enum(['low', 'normal', 'high']).or(z.string()).optional(),
    isDraft: z.boolean().optional(),
    createdDateTime: z.string().optional(),
    lastModifiedDateTime: z.string().optional(),
    webLink: z.string().optional(),
  })
  .passthrough();

export const createDraftMessageOutputSchema = z.object({
  id: z.string(),
  subject: z.string().optional(),
  body: BodySchemaWidened.optional(),
  toRecipients: z.array(RecipientSchema).optional(),
  ccRecipients: z.array(RecipientSchema).optional(),
  bccRecipients: z.array(RecipientSchema).optional(),
  importance: z.enum(['low', 'normal', 'high']).or(z.string()).optional(),
  isDraft: z.boolean().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  webLink: z.string().optional(),
});

export function createDraftMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_create_draft_message',
    description: 'Create a draft email message',
    inputSchema: createDraftMessageInputSchema,
    outputSchema: createDraftMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createDraftMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: Record<string, unknown> = {
        subject: input.subject,
        body: input.body,
        ...(input.toRecipients !== undefined && { toRecipients: input.toRecipients }),
        ...(input.ccRecipients !== undefined && { ccRecipients: input.ccRecipients }),
        ...(input.bccRecipients !== undefined && { bccRecipients: input.bccRecipients }),
        ...(input.importance !== undefined && { importance: input.importance }),
        ...(input.isReadReceiptRequested !== undefined && { isReadReceiptRequested: input.isReadReceiptRequested }),
        ...(input.isDeliveryReceiptRequested !== undefined && {
          isDeliveryReceiptRequested: input.isDeliveryReceiptRequested,
        }),
      };

      // https://learn.microsoft.com/graph/api/user-post-messages
      const response = await platformProxy.post({
        endpoint: '/v1.0/me/messages',
        data: requestBody,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: 'Failed to create draft message',
        });
      }

      const providerMessage = ProviderMessageSchema.parse(response.data);

      return {
        id: providerMessage.id,
        ...(providerMessage.subject !== undefined && { subject: providerMessage.subject }),
        ...(providerMessage.body !== undefined && { body: providerMessage.body }),
        ...(providerMessage.toRecipients !== undefined && { toRecipients: providerMessage.toRecipients }),
        ...(providerMessage.ccRecipients !== undefined && { ccRecipients: providerMessage.ccRecipients }),
        ...(providerMessage.bccRecipients !== undefined && { bccRecipients: providerMessage.bccRecipients }),
        ...(providerMessage.importance !== undefined && { importance: providerMessage.importance }),
        ...(providerMessage.isDraft !== undefined && { isDraft: providerMessage.isDraft }),
        ...(providerMessage.createdDateTime !== undefined && { createdDateTime: providerMessage.createdDateTime }),
        ...(providerMessage.lastModifiedDateTime !== undefined && {
          lastModifiedDateTime: providerMessage.lastModifiedDateTime,
        }),
        ...(providerMessage.webLink !== undefined && { webLink: providerMessage.webLink }),
      };
    },
  });
}
