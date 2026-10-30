// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const moveMessageInputSchema = z.object({
  messageId: z.string().describe('The unique identifier of the message to move. Example: "AAMkAGVmMDEz..."'),
  destinationId: z
    .string()
    .describe('The unique identifier of the destination mail folder. Example: "AAMkAGVmMDEzMjA..."'),
});

const ProviderMessageSchema = z.object({
  id: z.string(),
  parentFolderId: z.string(),
  subject: z.string().optional().nullable(),
  receivedDateTime: z.string().optional().nullable(),
  sentDateTime: z.string().optional().nullable(),
});

export const moveMessageOutputSchema = z.object({
  id: z.string(),
  parentFolderId: z.string(),
  subject: z.string().optional(),
  receivedDateTime: z.string().optional(),
  sentDateTime: z.string().optional(),
});

export function moveMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_move_message',
    description: 'Move a message to another mail folder.',
    inputSchema: moveMessageInputSchema,
    outputSchema: moveMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof moveMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://learn.microsoft.com/graph/api/message-move
        endpoint: `/v1.0/me/messages/${encodeURIComponent(input.messageId)}/move`,
        data: {
          destinationId: input.destinationId,
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'move_failed',
          message: 'Failed to move message',
          messageId: input.messageId,
        });
      }

      const movedMessage = ProviderMessageSchema.parse(response.data);

      return {
        id: movedMessage.id,
        parentFolderId: movedMessage.parentFolderId,
        ...(movedMessage.subject != null && { subject: movedMessage.subject }),
        ...(movedMessage.receivedDateTime != null && { receivedDateTime: movedMessage.receivedDateTime }),
        ...(movedMessage.sentDateTime != null && { sentDateTime: movedMessage.sentDateTime }),
      };
    },
  });
}
