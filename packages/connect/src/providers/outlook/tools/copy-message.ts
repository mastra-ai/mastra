// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const copyMessageInputSchema = z.object({
  messageId: z.string().describe('The ID of the message to copy. Example: "AQMkADAwATM0MDAAMS1iN..."'),
  destinationId: z
    .string()
    .describe(
      'The ID of the destination mail folder, or a well-known folder name such as "inbox", "drafts", "sentitems", "deleteditems".',
    ),
});

const MessageSchema = z.object({
  id: z.string(),
  subject: z.string().optional(),
  receivedDateTime: z.string().optional(),
  sentDateTime: z.string().optional(),
  hasAttachments: z.boolean().optional(),
  body: z
    .object({
      contentType: z.string().optional(),
      content: z.string().optional(),
    })
    .optional(),
  bodyPreview: z.string().optional(),
});

export const copyMessageOutputSchema = z.object({
  id: z.string(),
  subject: z.string().optional(),
  receivedDateTime: z.string().optional(),
  sentDateTime: z.string().optional(),
  hasAttachments: z.boolean().optional(),
  body: z
    .object({
      contentType: z.string().optional(),
      content: z.string().optional(),
    })
    .optional(),
  bodyPreview: z.string().optional(),
});

export function copyMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_copy_message',
    description: 'Copy a message to another mail folder.',
    inputSchema: copyMessageInputSchema,
    outputSchema: copyMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof copyMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://learn.microsoft.com/en-us/graph/api/message-copy
        endpoint: `/v1.0/me/messages/${encodeURIComponent(input.messageId)}/copy`,
        data: {
          destinationId: input.destinationId,
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Message not found or could not be copied',
          messageId: input.messageId,
        });
      }

      const message = MessageSchema.parse(response.data);

      return {
        id: message.id,
        ...(message.subject !== undefined && { subject: message.subject }),
        ...(message.receivedDateTime !== undefined && { receivedDateTime: message.receivedDateTime }),
        ...(message.sentDateTime !== undefined && { sentDateTime: message.sentDateTime }),
        ...(message.hasAttachments !== undefined && { hasAttachments: message.hasAttachments }),
        ...(message.body !== undefined && { body: message.body }),
        ...(message.bodyPreview !== undefined && { bodyPreview: message.bodyPreview }),
      };
    },
  });
}
