// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listLabelsInputSchema = z.object({});

const ProviderColorSchema = z.object({
  textColor: z.string().optional(),
  backgroundColor: z.string().optional(),
});

const ProviderLabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  messageListVisibility: z.string().optional(),
  labelListVisibility: z.string().optional(),
  type: z.string(),
  messagesTotal: z.number().optional(),
  messagesUnread: z.number().optional(),
  threadsTotal: z.number().optional(),
  threadsUnread: z.number().optional(),
  color: ProviderColorSchema.optional(),
});

const ProviderLabelsResponseSchema = z.object({
  labels: z.array(ProviderLabelSchema).optional(),
});

const LabelSchema = z.object({
  id: z.string().describe('The immutable ID of the label'),
  name: z.string().describe('The display name of the label'),
  type: z.string().describe('The owner type for the label: system or user'),
  messageListVisibility: z.string().optional().describe('The visibility of the label in the message list'),
  labelListVisibility: z.string().optional().describe('The visibility of the label in the label list'),
  messagesTotal: z.number().optional().describe('The total number of messages with the label'),
  messagesUnread: z.number().optional().describe('The number of unread messages with the label'),
  threadsTotal: z.number().optional().describe('The total number of threads with the label'),
  threadsUnread: z.number().optional().describe('The number of unread threads with the label'),
  textColor: z.string().optional().describe('The text color of the label'),
  backgroundColor: z.string().optional().describe('The background color of the label'),
});

export const listLabelsOutputSchema = z.object({
  labels: z.array(LabelSchema),
});

export function listLabelsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_list_labels',
    description: 'List built-in and user-created mailbox labels.',
    inputSchema: listLabelsInputSchema,
    outputSchema: listLabelsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listLabelsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.labels/list
      const response = await platformProxy.get({
        endpoint: '/gmail/v1/users/me/labels',
        retries: 3,
      });

      const parsed = ProviderLabelsResponseSchema.parse(response.data);
      const labels = parsed.labels || [];

      return {
        labels: labels.map(label => ({
          id: label.id,
          name: label.name,
          type: label.type,
          ...(label.messageListVisibility !== undefined && {
            messageListVisibility: label.messageListVisibility,
          }),
          ...(label.labelListVisibility !== undefined && {
            labelListVisibility: label.labelListVisibility,
          }),
          ...(label.messagesTotal !== undefined && {
            messagesTotal: label.messagesTotal,
          }),
          ...(label.messagesUnread !== undefined && {
            messagesUnread: label.messagesUnread,
          }),
          ...(label.threadsTotal !== undefined && {
            threadsTotal: label.threadsTotal,
          }),
          ...(label.threadsUnread !== undefined && {
            threadsUnread: label.threadsUnread,
          }),
          ...(label.color?.textColor !== undefined && {
            textColor: label.color.textColor,
          }),
          ...(label.color?.backgroundColor !== undefined && {
            backgroundColor: label.color.backgroundColor,
          }),
        })),
      };
    },
  });
}
