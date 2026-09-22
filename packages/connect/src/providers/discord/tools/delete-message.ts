// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const MetadataSchema = z.object({
  botToken: z.string().describe('Discord bot token'),
});

export const deleteMessageInputSchema = z.object({
  channelId: z.string().describe('Channel ID where the message exists. Example: "1234567890123456789"'),
  messageId: z.string().describe('Message ID to delete. Example: "9876543210987654321"'),
});

export const deleteMessageOutputSchema = z.object({
  success: z.boolean(),
  messageId: z.string().describe('ID of the deleted message'),
  channelId: z.string().describe('Channel ID where the message was deleted'),
});

export function deleteMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_delete_message',
    description: 'Delete or archive a message in Discord',
    inputSchema: deleteMessageInputSchema,
    outputSchema: deleteMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = MetadataSchema.safeParse(await platformProxy.getMetadata());

      if (!metadata.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'Invalid metadata: botToken is required.',
        });
      }

      const botToken = metadata.data.botToken;

      // https://discord.com/developers/docs/resources/message#delete-message
      await platformProxy.delete({
        endpoint: `/api/v10/channels/${input.channelId}/messages/${input.messageId}`,
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        retries: 3,
      });

      return {
        success: true,
        messageId: input.messageId,
        channelId: input.channelId,
      };
    },
  });
}
