// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const MetadataSchema = z.object({
  botToken: z.string(),
});

export const addGuildMemberRoleInputSchema = z.object({
  guildId: z.string().describe('Guild ID. Example: "123456789012345678"'),
  userId: z.string().describe('User ID. Example: "987654321098765432"'),
  roleId: z.string().describe('Role ID. Example: "111222333444555666"'),
});

export const addGuildMemberRoleOutputSchema = z.object({
  success: z.boolean(),
});

export function addGuildMemberRoleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_add_guild_member_role',
    description: 'Assign a role to a guild member.',
    inputSchema: addGuildMemberRoleInputSchema,
    outputSchema: addGuildMemberRoleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof addGuildMemberRoleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadataResult = MetadataSchema.safeParse(await platformProxy.getMetadata());

      if (!metadataResult.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in metadata.',
        });
      }

      const { botToken } = metadataResult.data;

      // https://discord.com/developers/docs/resources/guild#add-guild-member-role
      const response = await platformProxy.put({
        endpoint: `/api/v10/guilds/${input.guildId}/members/${input.userId}/roles/${input.roleId}`,
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        retries: 3,
      });

      if (response.status !== 204) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: `Failed to assign role. Status: ${response.status}`,
        });
      }

      return {
        success: true,
      };
    },
  });
}
