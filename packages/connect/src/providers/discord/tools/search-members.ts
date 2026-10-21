// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';
import { resolveDiscordBotToken } from './_bot-token.js';

export const searchMembersInputSchema = z.object({
  guild_id: z.string().describe('Guild ID. Example: "197038439483310086"'),
  query: z.string().min(1).describe('Username or nickname prefix to search for.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe('Max number of members to return (1-1000). Default: 25.'),
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
  roles: z.array(z.string()),
  joined_at: z.string().nullable(),
  premium_since: z.string().nullable().optional(),
  deaf: z.boolean(),
  mute: z.boolean(),
  flags: z.number(),
  pending: z.boolean().optional(),
  permissions: z.string().optional(),
  communication_disabled_until: z.string().nullable().optional(),
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

export const searchMembersOutputSchema = z.object({
  items: z.array(OutputMemberSchema),
});

export function searchMembersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_search_members',
    description:
      'Search guild members whose username or nickname starts with the query, instead of paging the full member list.',
    inputSchema: searchMembersInputSchema,
    outputSchema: searchMembersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchMembersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const botToken = await resolveDiscordBotToken(platformProxy);

      // https://discord.com/developers/docs/resources/guild#search-guild-members
      const response = await platformProxy.get({
        endpoint: `/api/v10/guilds/${input.guild_id}/members/search`,
        params: {
          query: input.query,
          limit: String(input.limit ?? 25),
        },
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        retries: 3,
      });

      const rawMembers = z.array(z.unknown()).parse(response.data);
      const items: Array<z.infer<typeof OutputMemberSchema>> = [];

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
      }

      return { items };
    },
  });
}
