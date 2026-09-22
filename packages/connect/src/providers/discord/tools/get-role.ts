// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getRoleInputSchema = z.object({
  guild_id: z.string().describe('Guild ID (snowflake). Example: "41771983423143936"'),
  role_id: z.string().describe('Role ID (snowflake). Example: "41771983423143937"'),
});

const RoleColorsSchema = z.object({
  primary_color: z.number().describe('The primary color for the role'),
  secondary_color: z.number().nullable().optional().describe('The secondary color for the role'),
  tertiary_color: z.number().nullable().optional().describe('The tertiary color for the role'),
});

const RoleTagsSchema = z
  .object({
    bot_id: z.string().optional().describe('The id of the bot this role belongs to'),
    integration_id: z.string().optional().describe('The id of the integration this role belongs to'),
    premium_subscriber: z.null().optional().describe("Whether this is the guild's Booster role"),
    subscription_listing_id: z.string().optional().describe("The id of this role's subscription sku and listing"),
    available_for_purchase: z.null().optional().describe('Whether this role is available for purchase'),
    guild_connections: z.null().optional().describe("Whether this role is a guild's linked role"),
  })
  .passthrough();

const ProviderRoleSchema = z
  .object({
    id: z.string().describe('Role id'),
    name: z.string().describe('Role name'),
    color: z.number().describe('Deprecated integer representation of hexadecimal color code'),
    colors: RoleColorsSchema.optional().describe("The role's colors"),
    hoist: z.boolean().describe('If this role is pinned in the user listing'),
    icon: z.string().nullable().optional().describe('Role icon hash'),
    unicode_emoji: z.string().nullable().optional().describe('Role unicode emoji'),
    position: z.number().describe('Position of this role'),
    permissions: z.string().describe('Permission bit set'),
    managed: z.boolean().describe('Whether this role is managed by an integration'),
    mentionable: z.boolean().describe('Whether this role is mentionable'),
    tags: RoleTagsSchema.optional().describe('The tags this role has'),
    flags: z.number().describe('Role flags combined as a bitfield'),
  })
  .passthrough();

export const getRoleOutputSchema = z.object({
  id: z.string().describe('Role id'),
  name: z.string().describe('Role name'),
  color: z.number().describe('Deprecated integer representation of hexadecimal color code'),
  colors: RoleColorsSchema.optional().describe("The role's colors"),
  hoist: z.boolean().describe('If this role is pinned in the user listing'),
  icon: z.string().optional().describe('Role icon hash'),
  unicode_emoji: z.string().optional().describe('Role unicode emoji'),
  position: z.number().describe('Position of this role'),
  permissions: z.string().describe('Permission bit set'),
  managed: z.boolean().describe('Whether this role is managed by an integration'),
  mentionable: z.boolean().describe('Whether this role is mentionable'),
  tags: RoleTagsSchema.optional().describe('The tags this role has'),
  flags: z.number().describe('Role flags combined as a bitfield'),
});

export function getRoleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_get_role',
    description: 'Retrieve a single role from Discord',
    inputSchema: getRoleInputSchema,
    outputSchema: getRoleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getRoleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ botToken: string }>();

      if (!metadata?.botToken) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in metadata.',
        });
      }

      // https://discord.com/developers/docs/resources/guild#get-guild-role
      const response = await platformProxy.get({
        endpoint: `/api/v10/guilds/${input.guild_id}/roles/${input.role_id}`,
        headers: {
          Authorization: `Bot ${metadata.botToken}`,
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Role not found',
          guild_id: input.guild_id,
          role_id: input.role_id,
        });
      }

      const providerRole = ProviderRoleSchema.parse(response.data);

      return {
        id: providerRole.id,
        name: providerRole.name,
        color: providerRole.color,
        ...(providerRole.colors !== undefined && { colors: providerRole.colors }),
        hoist: providerRole.hoist,
        ...(providerRole.icon != null && { icon: providerRole.icon }),
        ...(providerRole.unicode_emoji != null && { unicode_emoji: providerRole.unicode_emoji }),
        position: providerRole.position,
        permissions: providerRole.permissions,
        managed: providerRole.managed,
        mentionable: providerRole.mentionable,
        ...(providerRole.tags !== undefined && { tags: providerRole.tags }),
        flags: providerRole.flags,
      };
    },
  });
}
