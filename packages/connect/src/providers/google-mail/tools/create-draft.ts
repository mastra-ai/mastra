// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createDraftInputSchema = z.object({
  raw: z.string().describe('Base64url-encoded RFC 2822 MIME content of the draft message.'),
  threadId: z
    .string()
    .optional()
    .describe('Optional thread ID to add the draft to an existing thread. Example: "18f3a2b4c5d6e7f8"'),
});

const ProviderDraftSchema = z.object({
  id: z.string(),
  message: z
    .object({
      id: z.string(),
      threadId: z.string().optional(),
      labelIds: z.array(z.string()).optional(),
    })
    .optional(),
});

export const createDraftOutputSchema = z.object({
  id: z.string().describe('The ID of the created draft.'),
  messageId: z.string().optional().describe('The ID of the message within the draft.'),
  threadId: z.string().optional().describe('The thread ID associated with the draft message.'),
  labelIds: z.array(z.string()).optional().describe('Label IDs applied to the draft message.'),
});

export function createDraftTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_create_draft',
    description: 'Create a Gmail draft message from RFC 2822 MIME content.',
    inputSchema: createDraftInputSchema,
    outputSchema: createDraftOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createDraftOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/create
        endpoint: '/gmail/v1/users/me/drafts',
        data: {
          message: {
            raw: input.raw,
            ...(input.threadId !== undefined && { threadId: input.threadId }),
          },
        },
        retries: 3,
      });

      const draft = ProviderDraftSchema.parse(response.data);

      return {
        id: draft.id,
        ...(draft.message?.id !== undefined && { messageId: draft.message.id }),
        ...(draft.message?.threadId !== undefined && { threadId: draft.message.threadId }),
        ...(draft.message?.labelIds !== undefined && { labelIds: draft.message.labelIds }),
      };
    },
  });
}
