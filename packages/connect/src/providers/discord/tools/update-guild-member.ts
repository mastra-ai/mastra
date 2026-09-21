// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateGuildMemberInputSchema = z.object({
  guild_id: z.string().describe('Guild ID. Example: "1504364254634180618"'),
  user_id: z.string().describe('User ID of the member to update. Example: "1234567890123456789"'),
  nick: z.string().optional().nullable().describe("Value to set user's nickname to"),
  roles: z.array(z.string()).optional().nullable().describe('Array of role IDs to assign to the member'),
  mute: z.boolean().optional().nullable().describe('Whether the user is muted in voice channels'),
  deaf: z.boolean().optional().nullable().describe('Whether the user is deafened in voice channels'),
  channel_id: z
    .string()
    .optional()
    .nullable()
    .describe('ID of channel to move user to (if they are connected to voice)'),
  communication_disabled_until: z
    .string()
    .optional()
    .nullable()
    .describe(
      "ISO8601 timestamp when the user's timeout will expire (up to 28 days in the future), or null to remove timeout",
    ),
  flags: z.number().optional().nullable().describe('Guild member flags'),
  reason: z.string().optional().describe('Optional reason for the audit log'),
});

const GuildMemberSchema = z.object({
  user: z
    .object({
      id: z.string(),
      username: z.string(),
      discriminator: z.string(),
      global_name: z.string().nullable().optional(),
      avatar: z.string().nullable().optional(),
      bot: z.boolean().optional(),
      system: z.boolean().optional(),
      mfa_enabled: z.boolean().optional(),
      locale: z.string().optional(),
      verified: z.boolean().optional(),
      email: z.string().nullable().optional(),
      flags: z.number().optional(),
      premium_type: z.number().optional(),
      public_flags: z.number().optional(),
    })
    .optional(),
  nick: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  banner: z.string().nullable().optional(),
  roles: z.array(z.string()),
  joined_at: z.string().nullable(),
  premium_since: z.string().nullable().optional(),
  deaf: z.boolean(),
  mute: z.boolean(),
  flags: z.number(),
  pending: z.boolean().optional(),
  permissions: z.string().optional(),
  communication_disabled_until: z.string().nullable().optional(),
  avatar_decoration_data: z
    .object({
      asset: z.string(),
      sku_id: z.string().optional(),
    })
    .nullable()
    .optional(),
});

export const updateGuildMemberOutputSchema = z.object({
  user_id: z.string().describe('The ID of the user'),
  nick: z.string().optional(),
  roles: z.array(z.string()),
  deaf: z.boolean(),
  mute: z.boolean(),
  flags: z.number(),
  joined_at: z.string().optional(),
  premium_since: z.string().optional(),
  communication_disabled_until: z.string().optional(),
  pending: z.boolean().optional(),
  permissions: z.string().optional(),
});

export function updateGuildMemberTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_update_guild_member',
    description: 'Update a guild member in Discord',
    inputSchema: updateGuildMemberInputSchema,
    outputSchema: updateGuildMemberOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateGuildMemberOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ botToken: string }>();

      if (!metadata?.botToken) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in metadata. Please provide the bot token from your Discord application.',
        });
      }

      const body: Record<string, unknown> = {};

      if (input['nick'] !== undefined) {
        body['nick'] = input['nick'];
      }
      if (input['roles'] !== undefined) {
        body['roles'] = input['roles'];
      }
      if (input['mute'] !== undefined) {
        body['mute'] = input['mute'];
      }
      if (input['deaf'] !== undefined) {
        body['deaf'] = input['deaf'];
      }
      if (input['channel_id'] !== undefined) {
        body['channel_id'] = input['channel_id'];
      }
      if (input['communication_disabled_until'] !== undefined) {
        body['communication_disabled_until'] = input['communication_disabled_until'];
      }
      if (input['flags'] !== undefined) {
        body['flags'] = input['flags'];
      }

      const headers: Record<string, string> = {
        Authorization: `Bot ${metadata.botToken}`,
      };

      if (input.reason) {
        headers['X-Audit-Log-Reason'] = input.reason;
      }

      const isCurrentMember = input['user_id'] === '@me';

      if (isCurrentMember) {
        // https://discord.com/developers/docs/resources/guild#modify-current-member
        // Only 'nick' is supported for @me, filter body to only include nick
        const currentMemberBody: Record<string, unknown> = {};
        if (input['nick'] !== undefined) {
          currentMemberBody['nick'] = input['nick'];
        }

        const response = await platformProxy.patch({
          endpoint: `/api/v10/guilds/${input.guild_id}/members/@me`,
          headers: headers,
          data: currentMemberBody,
          retries: 3,
        });

        const member = GuildMemberSchema.parse(response.data);

        return {
          user_id: member.user?.id || input.user_id,
          ...(member.nick != null ? { nick: member.nick } : {}),
          roles: member.roles,
          deaf: member.deaf,
          mute: member.mute,
          flags: member.flags,
          ...(member.joined_at != null ? { joined_at: member.joined_at } : {}),
          ...(member.premium_since != null ? { premium_since: member.premium_since } : {}),
          ...(member.communication_disabled_until != null
            ? { communication_disabled_until: member.communication_disabled_until }
            : {}),
          ...(member.pending != null ? { pending: member.pending } : {}),
          ...(member.permissions != null ? { permissions: member.permissions } : {}),
        };
      }

      // https://discord.com/developers/docs/resources/guild#modify-guild-member
      const response = await platformProxy.patch({
        endpoint: `/api/v10/guilds/${input.guild_id}/members/${input.user_id}`,
        headers: headers,
        data: body,
        retries: 3,
      });

      const member = GuildMemberSchema.parse(response.data);

      return {
        user_id: member.user?.id || input.user_id,
        ...(member.nick != null ? { nick: member.nick } : {}),
        roles: member.roles,
        deaf: member.deaf,
        mute: member.mute,
        flags: member.flags,
        ...(member.joined_at != null ? { joined_at: member.joined_at } : {}),
        ...(member.premium_since != null ? { premium_since: member.premium_since } : {}),
        ...(member.communication_disabled_until != null
          ? { communication_disabled_until: member.communication_disabled_until }
          : {}),
        ...(member.pending != null ? { pending: member.pending } : {}),
        ...(member.permissions != null ? { permissions: member.permissions } : {}),
      };
    },
  });
}
