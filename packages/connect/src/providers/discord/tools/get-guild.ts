// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getGuildInputSchema = z.object({
  guildId: z.string().describe('Guild ID (snowflake). Example: "197038439483310086"'),
});

const ProviderGuildSchema = z.object({}).passthrough();

export const getGuildOutputSchema = z.object({}).passthrough();

export function getGuildTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_get_guild',
    description: 'Retrieve a single guild from Discord.',
    inputSchema: getGuildInputSchema,
    outputSchema: getGuildOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getGuildOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ botToken?: string }>();
      const botToken = metadata?.botToken;

      if (!botToken) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in metadata. Please configure the bot token from Discord Developer Portal.',
        });
      }

      // https://discord.com/developers/docs/resources/guild#get-guild
      const response = await platformProxy.get({
        endpoint: `/api/v10/guilds/${input.guildId}`,
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Guild not found',
          guildId: input.guildId,
        });
      }

      const guild = ProviderGuildSchema.parse(response.data);
      return guild;
    },
  });
}
