// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateLabelInputSchema = z.object({
  labelId: z.string().describe('The ID of the label to update. Example: "Label_1"'),
  name: z.string().optional().describe('The new name of the label.'),
  messageListVisibility: z
    .enum(['show', 'hide'])
    .optional()
    .describe('The visibility of the label in the message list.'),
  labelListVisibility: z
    .enum(['labelShow', 'labelShowIfUnread', 'labelHide'])
    .optional()
    .describe('The visibility of the label in the label list.'),
});

const ProviderLabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  messageListVisibility: z.enum(['show', 'hide']).or(z.string()).optional(),
  labelListVisibility: z.enum(['labelShow', 'labelShowIfUnread', 'labelHide']).or(z.string()).optional(),
  type: z.enum(['system', 'user']).or(z.string()).optional(),
  messagesTotal: z.number().optional(),
  messagesUnread: z.number().optional(),
  threadsTotal: z.number().optional(),
  threadsUnread: z.number().optional(),
});

export const updateLabelOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  messageListVisibility: z.enum(['show', 'hide']).or(z.string()).optional(),
  labelListVisibility: z.enum(['labelShow', 'labelShowIfUnread', 'labelHide']).or(z.string()).optional(),
  type: z.enum(['system', 'user']).or(z.string()).optional(),
  messagesTotal: z.number().optional(),
  messagesUnread: z.number().optional(),
  threadsTotal: z.number().optional(),
  threadsUnread: z.number().optional(),
});

export function updateLabelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_update_label',
    description: "Update a user-created label's name or visibility settings.",
    inputSchema: updateLabelInputSchema,
    outputSchema: updateLabelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateLabelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.labels/patch
      const response = await platformProxy.patch({
        endpoint: `/gmail/v1/users/me/labels/${encodeURIComponent(input.labelId)}`,
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.messageListVisibility !== undefined && {
            messageListVisibility: input.messageListVisibility,
          }),
          ...(input.labelListVisibility !== undefined && {
            labelListVisibility: input.labelListVisibility,
          }),
        },
        retries: 3,
      });

      const providerLabel = ProviderLabelSchema.parse(response.data);

      return {
        id: providerLabel.id,
        name: providerLabel.name,
        ...(providerLabel.messageListVisibility !== undefined && {
          messageListVisibility: providerLabel.messageListVisibility,
        }),
        ...(providerLabel.labelListVisibility !== undefined && {
          labelListVisibility: providerLabel.labelListVisibility,
        }),
        ...(providerLabel.type !== undefined && { type: providerLabel.type }),
        ...(providerLabel.messagesTotal !== undefined && {
          messagesTotal: providerLabel.messagesTotal,
        }),
        ...(providerLabel.messagesUnread !== undefined && {
          messagesUnread: providerLabel.messagesUnread,
        }),
        ...(providerLabel.threadsTotal !== undefined && {
          threadsTotal: providerLabel.threadsTotal,
        }),
        ...(providerLabel.threadsUnread !== undefined && {
          threadsUnread: providerLabel.threadsUnread,
        }),
      };
    },
  });
}
