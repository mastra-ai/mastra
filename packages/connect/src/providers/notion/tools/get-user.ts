// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getUserInputSchema = z.object({
  userId: z.string().describe('User ID to retrieve. Example: "e79a0b74-3aba-4149-9f74-0bb5791a6ee6"'),
});

const ProviderPersonSchema = z.object({
  email: z.string(),
});

const ProviderBotOwnerSchema = z.object({
  type: z.string(),
  user: z
    .object({
      id: z.string(),
      object: z.string(),
      name: z.string().nullable(),
      avatar_url: z.string().nullable(),
      type: z.string(),
      person: ProviderPersonSchema,
    })
    .optional(),
  workspace: z.boolean().optional(),
});

const ProviderBotInfoSchema = z.object({
  owner: ProviderBotOwnerSchema,
  workspace_id: z.string(),
  workspace_name: z.string().nullable(),
});

const ProviderUserSchema = z.object({
  id: z.string(),
  object: z.string(),
  name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  type: z.enum(['person', 'bot']),
  person: ProviderPersonSchema.optional(),
  bot: z.union([ProviderBotInfoSchema, z.object({})]).optional(),
});

export const getUserOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  avatarUrl: z.string().optional(),
  type: z.enum(['person', 'bot']),
  email: z.string().optional(),
  botOwner: z
    .object({
      type: z.string(),
      userId: z.string().optional(),
      userName: z.string().optional(),
      workspace: z.boolean().optional(),
    })
    .optional(),
});

export function getUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_get_user',
    description: 'Retrieve a Notion user or bot by user ID',
    inputSchema: getUserInputSchema,
    outputSchema: getUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.notion.com/reference/get-user
      const response = await platformProxy.get({
        endpoint: `/v1/users/${encodeURIComponent(input.userId)}`,
        retries: 3,
      });

      const providerUser = ProviderUserSchema.parse(response.data);

      const output: z.infer<typeof getUserOutputSchema> = {
        id: providerUser.id,
        type: providerUser.type,
      };

      if (providerUser.name != null) {
        output.name = providerUser.name;
      }

      if (providerUser.avatar_url != null) {
        output.avatarUrl = providerUser.avatar_url;
      }

      if (providerUser.type === 'person' && providerUser.person) {
        output.email = providerUser.person.email;
      }

      if (providerUser.type === 'bot' && providerUser.bot) {
        const bot = providerUser.bot;
        if ('owner' in bot && bot.owner) {
          output.botOwner = {
            type: bot.owner.type,
          };
          if (bot.owner.user) {
            output.botOwner.userId = bot.owner.user.id;
            if (bot.owner.user.name != null) {
              output.botOwner.userName = bot.owner.user.name;
            }
          }
          if (bot.owner.workspace != null) {
            output.botOwner.workspace = bot.owner.workspace;
          }
        }
      }

      return output;
    },
  });
}
