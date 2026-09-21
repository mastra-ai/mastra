// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const MetadataSchema = z.object({
  botToken: z.string().describe('Discord bot token from the Discord Developer Portal'),
});

export const deleteGuildInputSchema = z.object({
  guild_id: z.string().describe('The ID of the guild for the bot to leave.'),
});

export const deleteGuildOutputSchema = z.object({
  success: z.boolean().describe('Whether the bot successfully left the guild'),
  guild_id: z.string().describe('The ID of the guild that was left'),
});

export function deleteGuildTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_delete_guild',
    description:
      'Leave a guild in Discord. Note: Discord does not allow bots to delete guilds via the API; use this action to have the bot leave a guild instead.',
    inputSchema: deleteGuildInputSchema,
    outputSchema: deleteGuildOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteGuildOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata();
      const parsedMetadata = MetadataSchema.safeParse(metadata);

      if (!parsedMetadata.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in metadata. Please configure the bot token in the connection metadata.',
        });
      }

      const botToken = parsedMetadata.data.botToken;

      // Discord does not permit bots to delete guilds via the API.
      // DELETE /users/@me/guilds/{guild_id} is the bot-accessible endpoint to leave a guild.
      // https://discord.com/developers/docs/resources/user#leave-guild
      const response = await platformProxy.delete({
        endpoint: `/api/v10/users/@me/guilds/${input.guild_id}`,
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        retries: 1,
      });

      if (response.status !== 204) {
        throw new platformProxy.ActionError({
          type: 'leave_failed',
          message: `Failed to leave guild. Status: ${response.status}`,
          guild_id: input.guild_id,
        });
      }

      return {
        success: true,
        guild_id: input.guild_id,
      };
    },
  });
}
