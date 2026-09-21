// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteReactionInputSchema = z.object({
  channel_id: z.string().describe('The ID of the channel containing the message. Example: "123456789012345678"'),
  message_id: z.string().describe('The ID of the message to remove the reaction from. Example: "987654321098765432"'),
  emoji: z
    .string()
    .describe(
      'The emoji to remove. Provide the raw emoji character or name:id for custom emojis. Example: "👍" or "emojiName:123456789"',
    ),
});

export const deleteReactionOutputSchema = z.object({
  success: z.boolean(),
});

export function deleteReactionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_delete_reaction',
    description: 'Remove a reaction from a Discord message.',
    inputSchema: deleteReactionInputSchema,
    outputSchema: deleteReactionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteReactionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ botToken?: string }>();
      const botToken = metadata?.botToken;

      if (!botToken) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in metadata. Please configure the bot token from Discord Developer Portal.',
        });
      }

      // https://discord.com/developers/docs/resources/channel#delete-own-reaction
      // DELETE /channels/{channel.id}/messages/{message.id}/reactions/{emoji}/@me
      await platformProxy.delete({
        endpoint: `/api/v10/channels/${input.channel_id}/messages/${input.message_id}/reactions/${encodeURIComponent(input.emoji)}/@me`,
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        retries: 10,
      });

      return {
        success: true,
      };
    },
  });
}
