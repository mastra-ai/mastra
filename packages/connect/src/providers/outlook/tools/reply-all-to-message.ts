// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const replyAllToMessageInputSchema = z.object({
  messageId: z.string().describe('The ID of the message to reply to'),
  comment: z.string().optional().describe('A comment to include in the reply. Required when not creating a draft.'),
  createDraft: z.boolean().optional().describe('If true, creates a draft reply instead of sending immediately'),
  body: z
    .object({
      contentType: z.enum(['text', 'html']),
      content: z.string(),
    })
    .optional()
    .describe('The body of the reply message. Use instead of comment for more control.'),
});

export const replyAllToMessageInputSchemaWidened = z.object({
  messageId: z.string().describe('The ID of the message to reply to'),
  comment: z.string().optional().describe('A comment to include in the reply. Required when not creating a draft.'),
  createDraft: z.boolean().optional().describe('If true, creates a draft reply instead of sending immediately'),
  body: z
    .object({
      contentType: z.enum(['text', 'html']).or(z.string()),
      content: z.string(),
    })
    .optional()
    .describe('The body of the reply message. Use instead of comment for more control.'),
});

type InputType = z.infer<typeof replyAllToMessageInputSchemaWidened>;

export const replyAllToMessageOutputSchema = z.object({
  success: z.boolean(),
  draftId: z.string().optional().describe('The ID of the created draft (only when createDraft is true)'),
});

type OutputType = z.infer<typeof replyAllToMessageOutputSchema>;

const DraftMessageResponseSchema = z.object({
  id: z.string(),
});

export function replyAllToMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_reply_all_to_message',
    description: 'Reply to all recipients on a message',
    inputSchema: replyAllToMessageInputSchema,
    outputSchema: replyAllToMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof replyAllToMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const { messageId, comment, createDraft, body } = input;

      if (!messageId) {
        throw new platformProxy.ActionError({
          message: 'messageId is required',
        });
      }

      const encodedMessageId = encodeURIComponent(messageId);

      if (createDraft) {
        // https://learn.microsoft.com/graph/api/message-createreplyall
        const createResponse = await platformProxy.post({
          endpoint: `/v1.0/me/messages/${encodedMessageId}/createReplyAll`,
          retries: 3,
        });

        const parsedDraft = DraftMessageResponseSchema.safeParse(createResponse.data);
        if (!parsedDraft.success) {
          throw new platformProxy.ActionError({
            message: 'Failed to create reply draft: invalid response from provider',
            details: parsedDraft.error.issues,
          });
        }

        const draftId = parsedDraft.data.id;

        // If comment or body is provided, update the draft body
        if (comment || body) {
          const updatePayload: { body?: { contentType: string; content: string } } = {};
          if (body) {
            updatePayload.body = body;
          } else if (comment) {
            updatePayload.body = {
              contentType: 'text',
              content: comment,
            };
          }

          // https://learn.microsoft.com/graph/api/message-update
          await platformProxy.patch({
            endpoint: `/v1.0/me/messages/${encodeURIComponent(draftId)}`,
            data: updatePayload,
            retries: 3,
          });
        }

        return {
          success: true,
          draftId: draftId,
        };
      }

      // Direct replyAll without creating a draft first
      // https://learn.microsoft.com/graph/api/message-replyall
      const payload: { comment?: string; body?: { contentType: string; content: string } } = {};

      if (body) {
        payload.body = body;
      } else if (comment) {
        payload.comment = comment;
      } else {
        payload.comment = '';
      }

      await platformProxy.post({
        endpoint: `/v1.0/me/messages/${encodedMessageId}/replyAll`,
        data: payload,
        retries: 3,
      });

      return {
        success: true,
      };
    },
  });
}
