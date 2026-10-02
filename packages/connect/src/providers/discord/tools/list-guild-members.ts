// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listGuildMembersInputSchema = z.object({
  guild_id: z.string().describe('Guild ID. Example: "197038439483310086"'),
  limit: z.number().min(1).max(1000).optional().describe('Max number of members to return (1-1000).'),
  after: z.string().optional().describe('The highest user id in the previous page. Omit for the first page.'),
});

const ProviderUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  discriminator: z.string(),
  global_name: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  bot: z.boolean().optional(),
  system: z.boolean().optional(),
});

const ProviderGuildMemberSchema = z.object({
  user: ProviderUserSchema.optional(),
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
  avatar_decoration_data: z.unknown().nullable().optional(),
  collectibles: z.unknown().nullable().optional(),
});

const OutputMemberSchema = z.object({
  user: z
    .object({
      id: z.string(),
      username: z.string(),
      discriminator: z.string(),
      global_name: z.string().optional(),
      avatar: z.string().optional(),
      bot: z.boolean().optional(),
      system: z.boolean().optional(),
    })
    .optional(),
  nick: z.string().optional(),
  avatar: z.string().optional(),
  banner: z.string().optional(),
  roles: z.array(z.string()),
  joined_at: z.string().optional(),
  premium_since: z.string().optional(),
  deaf: z.boolean(),
  mute: z.boolean(),
  flags: z.number(),
  pending: z.boolean().optional(),
  permissions: z.string().optional(),
  communication_disabled_until: z.string().optional(),
});

export const listGuildMembersOutputSchema = z.object({
  items: z.array(OutputMemberSchema),
  next_after: z.string().optional(),
});

export function listGuildMembersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_list_guild_members',
    description: 'List guild members from Discord.',
    inputSchema: listGuildMembersInputSchema,
    outputSchema: listGuildMembersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listGuildMembersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata();
      const parsedMetadata = z.object({ botToken: z.string() }).safeParse(metadata);
      if (!parsedMetadata.success) {
        throw new platformProxy.ActionError({
          type: 'missing_bot_token',
          message: 'botToken is required in connection metadata.',
        });
      }

      const limit = input.limit ?? 100;

      // https://discord.com/developers/docs/resources/guild#list-guild-members
      const response = await platformProxy.get({
        endpoint: `/api/v10/guilds/${input.guild_id}/members`,
        params: {
          limit: String(limit),
          ...(input.after !== undefined && { after: input.after }),
        },
        headers: {
          Authorization: `Bot ${parsedMetadata.data.botToken}`,
        },
        retries: 3,
      });

      const rawMembers = z.array(z.unknown()).parse(response.data);
      const items: Array<z.infer<typeof OutputMemberSchema>> = [];
      let lastUserId: string | undefined;

      for (const rawMember of rawMembers) {
        const providerMember = ProviderGuildMemberSchema.parse(rawMember);

        const user = providerMember.user
          ? {
              id: providerMember.user.id,
              username: providerMember.user.username,
              discriminator: providerMember.user.discriminator,
              ...(providerMember.user.global_name != null && { global_name: providerMember.user.global_name }),
              ...(providerMember.user.avatar != null && { avatar: providerMember.user.avatar }),
              ...(providerMember.user.bot !== undefined && { bot: providerMember.user.bot }),
              ...(providerMember.user.system !== undefined && { system: providerMember.user.system }),
            }
          : undefined;

        items.push({
          ...(user !== undefined && { user }),
          ...(providerMember.nick != null && { nick: providerMember.nick }),
          ...(providerMember.avatar != null && { avatar: providerMember.avatar }),
          ...(providerMember.banner != null && { banner: providerMember.banner }),
          roles: providerMember.roles,
          ...(providerMember.joined_at != null && { joined_at: providerMember.joined_at }),
          ...(providerMember.premium_since != null && { premium_since: providerMember.premium_since }),
          deaf: providerMember.deaf,
          mute: providerMember.mute,
          flags: providerMember.flags,
          ...(providerMember.pending !== undefined && { pending: providerMember.pending }),
          ...(providerMember.permissions !== undefined && { permissions: providerMember.permissions }),
          ...(providerMember.communication_disabled_until != null && {
            communication_disabled_until: providerMember.communication_disabled_until,
          }),
        });

        if (providerMember.user) {
          lastUserId = providerMember.user.id;
        }
      }

      const nextAfter = items.length === limit && lastUserId ? lastUserId : undefined;

      return {
        items,
        ...(nextAfter !== undefined && { next_after: nextAfter }),
      };
    },
  });
}
