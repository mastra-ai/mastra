// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createLabelInputSchema = z.object({
  name: z.string().describe('The display name of the label. Example: "Work"'),
  labelListVisibility: z
    .enum(['labelHide', 'labelShow', 'labelShowIfUnread'])
    .optional()
    .describe('The visibility of the label in the label list. Example: "labelShow"'),
  messageListVisibility: z
    .enum(['hide', 'show'])
    .optional()
    .describe('The visibility of the label in the message list. Example: "show"'),
  type: z.enum(['user']).optional().describe('The type of the label. Only "user" can be created. Defaults to "user".'),
});

const ProviderLabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  labelListVisibility: z.string().optional(),
  messageListVisibility: z.string().optional(),
  type: z.string().optional(),
  messagesTotal: z.number().optional(),
  messagesUnread: z.number().optional(),
  threadsTotal: z.number().optional(),
  threadsUnread: z.number().optional(),
});

export const createLabelOutputSchema = z.object({
  id: z.string().describe('The immutable ID of the label.'),
  name: z.string().describe('The display name of the label.'),
  labelListVisibility: z.string().optional().describe('The visibility of the label in the label list.'),
  messageListVisibility: z.string().optional().describe('The visibility of the label in the message list.'),
  type: z.string().optional().describe('The type of the label.'),
});

export function createLabelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_create_label',
    description: 'Create a new user label with visibility settings.',
    inputSchema: createLabelInputSchema,
    outputSchema: createLabelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createLabelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.labels/create
      const response = await platformProxy.post({
        endpoint: '/gmail/v1/users/me/labels',
        data: {
          name: input.name,
          ...(input.labelListVisibility !== undefined && {
            labelListVisibility: input.labelListVisibility,
          }),
          ...(input.messageListVisibility !== undefined && {
            messageListVisibility: input.messageListVisibility,
          }),
          ...(input.type !== undefined && { type: input.type }),
        },
        retries: 3,
      });

      const providerLabel = ProviderLabelSchema.parse(response.data);

      return {
        id: providerLabel.id,
        name: providerLabel.name,
        ...(providerLabel.labelListVisibility !== undefined && {
          labelListVisibility: providerLabel.labelListVisibility,
        }),
        ...(providerLabel.messageListVisibility !== undefined && {
          messageListVisibility: providerLabel.messageListVisibility,
        }),
        ...(providerLabel.type !== undefined && { type: providerLabel.type }),
      };
    },
  });
}
