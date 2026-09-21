// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getGuildMemberInputSchema = z.object({
  guild_id: z.string().describe('The ID of the guild. Example: "197038439483310086"'),
  user_id: z.string().describe('The ID of the user. Example: "73193882359173120"'),
});

const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  discriminator: z.string(),
  global_name: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  bot: z.boolean().optional(),
  system: z.boolean().optional(),
  mfa_enabled: z.boolean().optional(),
  banner: z.string().nullable().optional(),
  accent_color: z.number().nullable().optional(),
  locale: z.string().optional(),
  verified: z.boolean().optional(),
  email: z.string().nullable().optional(),
  flags: z.number().optional(),
  premium_type: z.number().optional(),
  public_flags: z.number().optional(),
  avatar_decoration_data: z.unknown().nullable().optional(),
  collectibles: z.unknown().nullable().optional(),
});

export const getGuildMemberOutputSchema = z.object({
  user: UserSchema.nullable().optional(),
  nick: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  banner: z.string().nullable().optional(),
  roles: z.array(z.string()),
  joined_at: z.string().nullable().optional(),
  premium_since: z.string().nullable().optional(),
  deaf: z.boolean(),
  mute: z.boolean(),
  flags: z.number(),
  pending: z.boolean().optional(),
  permissions: z.string().optional(),
  communication_disabled_until: z.string().nullable().optional(),
  avatar_decoration_data: z.unknown().nullable().optional(),
  collectibles: z.unknown().nullable().optional(),
});

export function getGuildMemberTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_get_guild_member',
    description: 'Retrieve a single guild member from Discord',
    inputSchema: getGuildMemberInputSchema,
    outputSchema: getGuildMemberOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getGuildMemberOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ botToken: string }>();

      if (!metadata?.botToken) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in metadata.',
        });
      }

      const response = await platformProxy.get({
        // https://discord.com/developers/docs/resources/guild#get-guild-member
        endpoint: `/api/v10/guilds/${input.guild_id}/members/${input.user_id}`,
        headers: {
          Authorization: `Bot ${metadata.botToken}`,
        },
        retries: 3,
      });

      if (response.status === 404) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Guild member not found',
          guild_id: input.guild_id,
          user_id: input.user_id,
        });
      }

      const member = getGuildMemberOutputSchema.parse(response.data);

      return {
        user: member.user ?? undefined,
        nick: member.nick ?? undefined,
        avatar: member.avatar ?? undefined,
        banner: member.banner ?? undefined,
        roles: member.roles,
        joined_at: member.joined_at ?? undefined,
        premium_since: member.premium_since ?? undefined,
        deaf: member.deaf,
        mute: member.mute,
        flags: member.flags,
        pending: member.pending ?? undefined,
        permissions: member.permissions ?? undefined,
        communication_disabled_until: member.communication_disabled_until ?? undefined,
        avatar_decoration_data: member.avatar_decoration_data ?? undefined,
        collectibles: member.collectibles ?? undefined,
      };
    },
  });
}
