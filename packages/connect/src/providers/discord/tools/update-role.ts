// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateRoleInputSchema = z.object({
  guildId: z.string().describe('Guild ID. Example: "197038439483310086"'),
  roleId: z.string().describe('Role ID. Example: "41771983423143936"'),
  name: z.string().max(100).optional().describe('Name of the role, max 100 characters'),
  permissions: z.string().optional().describe('Bitwise value of the enabled/disabled permissions'),
  color: z.number().optional().describe('Deprecated RGB color value'),
  colors: z
    .object({
      primary_color: z.number().optional(),
      secondary_color: z.number().nullable().optional(),
      tertiary_color: z.number().nullable().optional(),
    })
    .optional()
    .describe("The role's colors"),
  hoist: z.boolean().optional().describe('Whether the role should be displayed separately in the sidebar'),
  icon: z.string().nullable().optional().describe("The role's icon image (if the guild has the ROLE_ICONS feature)"),
  unicodeEmoji: z
    .string()
    .nullable()
    .optional()
    .describe("The role's unicode emoji as a standard emoji (if the guild has the ROLE_ICONS feature)"),
  mentionable: z.boolean().optional().describe('Whether the role should be mentionable'),
});

const RoleColorsSchema = z.object({
  primary_color: z.number(),
  secondary_color: z.number().nullable(),
  tertiary_color: z.number().nullable(),
});

const RoleTagsSchema = z.object({
  bot_id: z.string().optional(),
  integration_id: z.string().optional(),
  premium_subscriber: z.null().optional(),
  subscription_listing_id: z.string().optional(),
  available_for_purchase: z.null().optional(),
  guild_connections: z.null().optional(),
});

export const updateRoleOutputSchema = z.object({
  id: z.string().describe('Role ID'),
  name: z.string().describe('Role name'),
  color: z.number().describe('Deprecated integer representation of hexadecimal color code'),
  colors: RoleColorsSchema.optional().describe("The role's colors"),
  hoist: z.boolean().describe('If this role is pinned in the user listing'),
  icon: z.string().nullable().optional().describe('Role icon hash'),
  unicode_emoji: z.string().nullable().optional().describe('Role unicode emoji'),
  position: z.number().describe('Position of this role (roles with the same position are sorted by id)'),
  permissions: z.string().describe('Permission bit set'),
  managed: z.boolean().describe('Whether this role is managed by an integration'),
  mentionable: z.boolean().describe('Whether this role is mentionable'),
  tags: RoleTagsSchema.optional().describe('The tags this role has'),
  flags: z.number().describe('Role flags combined as a bitfield'),
});

export function updateRoleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_update_role',
    description: 'Update a role in Discord',
    inputSchema: updateRoleInputSchema,
    outputSchema: updateRoleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateRoleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ botToken: string }>();
      const botToken = metadata?.botToken;

      if (!botToken) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in metadata.',
        });
      }

      if (
        input.icon !== undefined &&
        input.icon !== null &&
        input.unicodeEmoji !== undefined &&
        input.unicodeEmoji !== null
      ) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'icon and unicodeEmoji are mutually exclusive; provide at most one.',
        });
      }

      const data: Record<string, unknown> = {};
      if (input.name !== undefined) {
        data['name'] = input.name;
      }
      if (input.permissions !== undefined) {
        data['permissions'] = input.permissions;
      }
      if (input.color !== undefined) {
        data['color'] = input.color;
      }
      if (input.colors !== undefined) {
        data['colors'] = input.colors;
      }
      if (input.hoist !== undefined) {
        data['hoist'] = input.hoist;
      }
      if (input.icon !== undefined) {
        data['icon'] = input.icon;
      }
      if (input.unicodeEmoji !== undefined) {
        data['unicode_emoji'] = input.unicodeEmoji;
      }
      if (input.mentionable !== undefined) {
        data['mentionable'] = input.mentionable;
      }

      // https://discord.com/developers/docs/resources/guild#modify-guild-role
      const response = await platformProxy.patch({
        endpoint: `/api/v10/guilds/${input.guildId}/roles/${input.roleId}`,
        headers: {
          Authorization: `Bot ${botToken}`,
          'X-Audit-Log-Reason': 'Role updated via Nango',
        },
        data,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Role not found or could not be updated',
          guildId: input.guildId,
          roleId: input.roleId,
        });
      }

      const providerRole = updateRoleOutputSchema.parse(response.data);

      return providerRole;
    },
  });
}
