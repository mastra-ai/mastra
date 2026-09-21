// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const removeGuildMemberRoleInputSchema = z.object({
  guild_id: z.string().describe('Guild ID. Example: "123456789"'),
  user_id: z.string().describe('User ID of the member. Example: "987654321"'),
  role_id: z.string().describe('Role ID to remove from the member. Example: "456789123"'),
});

export const removeGuildMemberRoleOutputSchema = z.object({
  success: z.boolean(),
  guild_id: z.string(),
  user_id: z.string(),
  role_id: z.string(),
});

export function removeGuildMemberRoleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_remove_guild_member_role',
    description: 'Remove a role from a guild member',
    inputSchema: removeGuildMemberRoleInputSchema,
    outputSchema: removeGuildMemberRoleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof removeGuildMemberRoleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ botToken: string }>();
      const botToken = metadata?.botToken;

      if (!botToken) {
        throw new platformProxy.ActionError({
          type: 'missing_bot_token',
          message: 'Bot token is required in metadata. Please configure the botToken in your connection metadata.',
        });
      }

      // https://discord.com/developers/docs/resources/guild#delete-guild-member-role
      const response = await platformProxy.delete({
        endpoint: `/api/v10/guilds/${input.guild_id}/members/${input.user_id}/roles/${input.role_id}`,
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        retries: 3,
      });

      if (response.status !== 204) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: `Failed to remove role: Discord API returned status ${response.status}`,
          guild_id: input.guild_id,
          user_id: input.user_id,
          role_id: input.role_id,
        });
      }

      return {
        success: true,
        guild_id: input.guild_id,
        user_id: input.user_id,
        role_id: input.role_id,
      };
    },
  });
}
