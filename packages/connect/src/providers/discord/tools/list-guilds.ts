// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listGuildsInputSchema = z.object({
  after: z
    .string()
    .optional()
    .describe(
      'Get guilds after this guild ID. Omit for the first page, or use the next_cursor from the previous response.',
    ),
  limit: z.number().min(1).max(200).optional().describe('Maximum number of guilds to return (1-200, default: 200).'),
});

const GuildSchema = z.object({
  id: z.string().describe('Guild ID.'),
  name: z.string().describe('Guild name.'),
  icon: z.string().nullable().describe('Icon hash or null.'),
  owner: z.boolean().describe('Whether the user is the owner of the guild.'),
  features: z.array(z.string()).describe('Enabled guild features.'),
  permissions: z.string().optional().describe('Permissions for the user in the guild.'),
  approximate_member_count: z
    .number()
    .optional()
    .describe('Approximate number of members in the guild (if with_counts enabled).'),
  approximate_presence_count: z
    .number()
    .optional()
    .describe('Approximate number of online members (if with_counts enabled).'),
});

export const listGuildsOutputSchema = z.object({
  items: z.array(GuildSchema).describe('List of guilds.'),
  next_cursor: z.string().optional().describe('Cursor for the next page of results. Omit if there are no more pages.'),
});

export function listGuildsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_list_guilds',
    description: 'List guilds from Discord.',
    inputSchema: listGuildsInputSchema,
    outputSchema: listGuildsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listGuildsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ botToken?: string }>();
      const botToken = metadata?.botToken;

      if (!botToken) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in metadata.',
        });
      }

      const limit = input.limit ?? 200;

      // https://discord.com/developers/docs/resources/user#get-current-user-guilds
      const response = await platformProxy.get({
        endpoint: '/api/v10/users/@me/guilds',
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        params: {
          limit: String(limit),
          ...(input.after && { after: input.after }),
        },
        retries: 3,
      });

      const guilds = z.array(GuildSchema).parse(response.data);

      const nextCursor = guilds.length === limit ? guilds[guilds.length - 1]?.id : undefined;

      return {
        items: guilds,
        ...(nextCursor && { next_cursor: nextCursor }),
      };
    },
  });
}
