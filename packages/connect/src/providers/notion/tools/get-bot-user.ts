// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getBotUserInputSchema = z.object({});

const OwnerUserSchema = z.object({
  type: z.literal('user'),
  user: z.object({
    id: z.string(),
    object: z.literal('user'),
    name: z.string().nullable(),
    avatar_url: z.string().nullable(),
    type: z.literal('person'),
    person: z.object({
      email: z.string(),
    }),
  }),
});

const OwnerWorkspaceSchema = z.object({
  type: z.literal('workspace'),
  workspace: z.literal(true),
});

const BotInfoSchema = z.object({
  owner: z.union([OwnerUserSchema, OwnerWorkspaceSchema]),
  workspace_id: z.string(),
  workspace_limits: z.object({
    max_file_upload_size_in_bytes: z.number(),
  }),
  workspace_name: z.string().nullable(),
});

const ProviderUserSchema = z.object({
  id: z.string(),
  object: z.literal('user'),
  name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  type: z.literal('bot'),
  bot: BotInfoSchema,
});

export const getBotUserOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  avatar_url: z.string().optional(),
  type: z.literal('bot'),
  bot: z.object({
    owner: z.object({
      type: z.enum(['user', 'workspace']),
      user_id: z.string().optional(),
      user_name: z.string().optional(),
      user_email: z.string().optional(),
    }),
    workspace_id: z.string(),
    workspace_name: z.string().optional(),
    max_file_upload_size_in_bytes: z.number(),
  }),
});

export function getBotUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_get_bot_user',
    description: 'Retrieve the bot user associated with the current integration token.',
    inputSchema: getBotUserInputSchema,
    outputSchema: getBotUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getBotUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://developers.notion.com/reference/get-self
        endpoint: '/v1/users/me',
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Bot user not found',
        });
      }

      const providerUser = ProviderUserSchema.parse(response.data);

      const ownerType = providerUser.bot.owner.type;

      let ownerOutput: {
        type: 'user' | 'workspace';
        user_id?: string | undefined;
        user_name?: string | undefined;
        user_email?: string | undefined;
      };

      if (ownerType === 'user') {
        ownerOutput = {
          type: 'user',
          user_id: providerUser.bot.owner.user.id,
          user_name: providerUser.bot.owner.user.name ?? undefined,
          user_email: providerUser.bot.owner.user.person.email,
        };
      } else {
        ownerOutput = {
          type: 'workspace',
        };
      }

      return {
        id: providerUser.id,
        ...(providerUser.name != null && { name: providerUser.name }),
        ...(providerUser.avatar_url != null && { avatar_url: providerUser.avatar_url }),
        type: 'bot',
        bot: {
          owner: ownerOutput,
          workspace_id: providerUser.bot.workspace_id,
          ...(providerUser.bot.workspace_name != null && { workspace_name: providerUser.bot.workspace_name }),
          max_file_upload_size_in_bytes: providerUser.bot.workspace_limits.max_file_upload_size_in_bytes,
        },
      };
    },
  });
}
