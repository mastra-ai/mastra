// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listRolesInputSchema = z.object({
  guild_id: z.string().describe('Guild ID to list roles from. Example: "123456789012345678"'),
});

const RoleColorsSchema = z.object({
  primary_color: z.number(),
  secondary_color: z.number().nullable().optional(),
  tertiary_color: z.number().nullable().optional(),
});

const RoleTagsSchema = z.object({
  bot_id: z.string().optional(),
  integration_id: z.string().optional(),
  premium_subscriber: z.null().optional(),
  subscription_listing_id: z.string().optional(),
  available_for_purchase: z.null().optional(),
  guild_connections: z.null().optional(),
});

const ProviderRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.number(),
  colors: RoleColorsSchema.optional(),
  hoist: z.boolean(),
  icon: z.string().nullable().optional(),
  unicode_emoji: z.string().nullable().optional(),
  position: z.number(),
  permissions: z.string(),
  managed: z.boolean(),
  mentionable: z.boolean(),
  tags: RoleTagsSchema.optional(),
  flags: z.number(),
});

const RoleOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.number(),
  colors: RoleColorsSchema.optional(),
  hoist: z.boolean(),
  icon: z.string().optional(),
  unicode_emoji: z.string().optional(),
  position: z.number(),
  permissions: z.string(),
  managed: z.boolean(),
  mentionable: z.boolean(),
  tags: RoleTagsSchema.optional(),
  flags: z.number(),
});

export const listRolesOutputSchema = z.object({
  roles: z.array(RoleOutputSchema),
});

export function listRolesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_list_roles',
    description: 'List roles from Discord.',
    inputSchema: listRolesInputSchema,
    outputSchema: listRolesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listRolesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ botToken?: string }>();
      const botToken = metadata?.botToken;

      if (!botToken) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in metadata.',
        });
      }

      // https://discord.com/developers/docs/resources/guild#get-guild-roles
      const response = await platformProxy.get({
        endpoint: `/api/v10/guilds/${input.guild_id}/roles`,
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'No roles found for this guild',
          guild_id: input.guild_id,
        });
      }

      const roles = z.array(ProviderRoleSchema).parse(response.data);

      return {
        roles: roles.map(role => ({
          id: role.id,
          name: role.name,
          color: role.color,
          ...(role.colors !== undefined && { colors: role.colors }),
          hoist: role.hoist,
          ...(role.icon != null && { icon: role.icon }),
          ...(role.unicode_emoji != null && { unicode_emoji: role.unicode_emoji }),
          position: role.position,
          permissions: role.permissions,
          managed: role.managed,
          mentionable: role.mentionable,
          ...(role.tags && { tags: role.tags }),
          flags: role.flags,
        })),
      };
    },
  });
}
