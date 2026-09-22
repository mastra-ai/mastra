// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteRoleInputSchema = z.object({
  guildId: z.string().describe('The ID of the guild containing the role. Example: "1234567890123456789"'),
  roleId: z.string().describe('The ID of the role to delete. Example: "9876543210987654321"'),
});

const ProviderRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.number().optional(),
  hoist: z.boolean().optional(),
  icon: z.string().nullable().optional(),
  unicode_emoji: z.string().nullable().optional(),
  position: z.number().optional(),
  permissions: z.string().optional(),
  managed: z.boolean().optional(),
  mentionable: z.boolean().optional(),
  flags: z.number().optional(),
});

export const deleteRoleOutputSchema = z.object({
  id: z.string().describe('The ID of the deleted role'),
  name: z.string().describe('The name of the deleted role'),
  success: z.boolean().describe('Whether the deletion was successful'),
});

export function deleteRoleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_delete_role',
    description: 'Delete a role in a Discord guild',
    inputSchema: deleteRoleInputSchema,
    outputSchema: deleteRoleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteRoleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ botToken?: string }>();
      const botToken = metadata?.botToken;

      if (!botToken) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message:
            'botToken is required in metadata. Please provide the Discord bot token from your Discord application settings.',
        });
      }

      // https://discord.com/developers/docs/resources/guild#delete-guild-role
      const response = await platformProxy.delete({
        endpoint: `/api/v10/guilds/${input.guildId}/roles/${input.roleId}`,
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        retries: 3,
      });

      // Discord returns 204 No Content on successful deletion
      // If the API returns the role object (older behavior), parse it
      const roleData = response.data ? ProviderRoleSchema.parse(response.data) : null;

      return {
        id: input.roleId,
        name: roleData?.name || 'Unknown',
        success: response.status === 204 || response.status === 200,
      };
    },
  });
}
