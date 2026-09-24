// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createReactionInputSchema = z.object({
  channel_id: z.string().describe('Channel ID where the message is located. Example: "1504364254634180618"'),
  message_id: z.string().describe('Message ID to add the reaction to. Example: "1234567890123456789"'),
  emoji: z
    .string()
    .describe(
      'Emoji to add as a reaction. Can be a unicode emoji (e.g., "👍") or custom emoji format (e.g., "emoji_name:emoji_id"). Example: "👍" or "custom_emoji:123456789"',
    ),
});

export const createReactionOutputSchema = z.object({
  success: z.boolean(),
  channel_id: z.string(),
  message_id: z.string(),
  emoji: z.string(),
});

export function createReactionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_create_reaction',
    description: 'Add a reaction to a Discord message.',
    inputSchema: createReactionInputSchema,
    outputSchema: createReactionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createReactionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ botToken?: string }>();
      const botToken = metadata?.botToken;

      if (!botToken) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in metadata. Please configure the Discord bot token.',
        });
      }

      // https://discord.com/developers/docs/resources/channel#create-reaction
      await platformProxy.put({
        endpoint: `/api/v10/channels/${input.channel_id}/messages/${input.message_id}/reactions/${encodeURIComponent(input.emoji)}/@me`,
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        retries: 1,
      });

      return {
        success: true,
        channel_id: input.channel_id,
        message_id: input.message_id,
        emoji: input.emoji,
      };
    },
  });
}
