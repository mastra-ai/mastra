// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listUsersInputSchema = z.object({
  start_cursor: z
    .string()
    .optional()
    .describe('Pagination cursor from the previous response. Omit for the first page.'),
  page_size: z.number().optional().describe('Number of users to return. Maximum is 100.'),
});

const PersonUserSchema = z.object({
  type: z.literal('person'),
  person: z.object({
    email: z.string().optional(),
  }),
});

const BotUserSchema = z.object({
  type: z.literal('bot'),
  bot: z.union([z.object({}), z.object({}).passthrough()]),
});

const ProviderUserSchema = z.object({
  id: z.string(),
  object: z.literal('user'),
  type: z.enum(['person', 'bot']),
  name: z.string().nullable(),
  avatar_url: z.string().nullable(),
});

const PersonProviderUserSchema = ProviderUserSchema.and(PersonUserSchema);

const BotProviderUserSchema = ProviderUserSchema.and(BotUserSchema);

const ProviderListResponseSchema = z.object({
  object: z.literal('list'),
  results: z.array(z.union([PersonProviderUserSchema, BotProviderUserSchema])),
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
});

const UserOutputSchema = z.object({
  id: z.string(),
  type: z.enum(['person', 'bot']),
  name: z.string().optional(),
  avatar_url: z.string().optional(),
  email: z.string().optional(),
});

export const listUsersOutputSchema = z.object({
  users: z.array(UserOutputSchema),
  next_cursor: z.string().optional(),
  has_more: z.boolean(),
});

export function listUsersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_list_users',
    description: 'List Notion users and bots available to the integration.',
    inputSchema: listUsersInputSchema,
    outputSchema: listUsersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listUsersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};
      if (input.start_cursor !== undefined) {
        params['start_cursor'] = input.start_cursor;
      }
      if (input.page_size !== undefined) {
        params['page_size'] = input.page_size;
      }

      // https://developers.notion.com/reference/get-users
      const response = await platformProxy.get({
        endpoint: '/v1/users',
        params,
        retries: 3,
      });

      const validated = ProviderListResponseSchema.parse(response.data);

      const users = validated.results.map(user => {
        const base = {
          id: user.id,
          type: user.type,
          ...(user.name != null && { name: user.name }),
          ...(user.avatar_url != null && { avatar_url: user.avatar_url }),
        };

        if (user.type === 'person') {
          return {
            ...base,
            email: user.person.email,
          };
        }

        return base;
      });

      return {
        users,
        ...(validated.next_cursor != null && { next_cursor: validated.next_cursor }),
        has_more: validated.has_more,
      };
    },
  });
}
