// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const MetadataSchema = z.object({
  botToken: z.string().describe('Discord bot token for authentication'),
});

export const deleteGuildMemberInputSchema = z.object({
  guild_id: z.string().describe('Guild ID. Example: "123456789012345678"'),
  user_id: z.string().describe('User ID of the member to delete. Example: "987654321098765432"'),
});

export const deleteGuildMemberOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export function deleteGuildMemberTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_delete_guild_member',
    description: 'Delete or archive a guild member in Discord',
    inputSchema: deleteGuildMemberInputSchema,
    outputSchema: deleteGuildMemberOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteGuildMemberOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{
        botToken?: string;
      }>();

      if (!metadata?.botToken) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in connection metadata',
        });
      }

      // https://discord.com/developers/docs/resources/guild#remove-guild-member
      let response: { status: number } | undefined;
      try {
        response = await platformProxy.delete({
          endpoint: `/api/v10/guilds/${input.guild_id}/members/${input.user_id}`,
          headers: {
            Authorization: `Bot ${metadata.botToken}`,
          },
          retries: 1,
        });
      } catch (err: unknown) {
        const status =
          err !== null &&
          typeof err === 'object' &&
          'response' in err &&
          err.response !== null &&
          typeof err.response === 'object' &&
          'status' in err.response &&
          typeof err.response.status === 'number'
            ? err.response.status
            : undefined;
        if (status === 404) {
          return {
            success: false,
            message: `User ${input.user_id} is not a member of guild ${input.guild_id}`,
          };
        }
        throw err;
      }

      if (response?.status === 404) {
        return {
          success: false,
          message: `User ${input.user_id} is not a member of guild ${input.guild_id}`,
        };
      }

      return {
        success: true,
        message: `Member ${input.user_id} successfully removed from guild ${input.guild_id}`,
      };
    },
  });
}
