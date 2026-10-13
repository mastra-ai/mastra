// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const UserSchema = z.object({
  id: z.string(),
  team_id: z.string(),
  name: z.string(),
  deleted: z.boolean(),
  real_name: z.string().optional(),
  profile: z
    .object({
      real_name: z.string().optional(),
      display_name: z.string().optional(),
      email: z.string().optional(),
      avatar_hash: z.string().optional(),
      image_24: z.string().optional(),
      image_32: z.string().optional(),
      image_48: z.string().optional(),
      image_72: z.string().optional(),
      image_192: z.string().optional(),
      image_512: z.string().optional(),
    })
    .passthrough(),
  is_admin: z.boolean(),
  is_owner: z.boolean(),
  is_bot: z.boolean(),
  updated: z.number(),
});

export const listUsersInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from previous response. Omit for first page.'),
});

export const listUsersOutputSchema = z.object({
  items: z.array(UserSchema),
  next_cursor: z.string().optional().describe('Pagination cursor for the next page. Omitted if no more pages.'),
});

export function listUsersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_list_users',
    description: 'List all users in the workspace',
    inputSchema: listUsersInputSchema,
    outputSchema: listUsersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listUsersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.com/methods/users.list
      const config = {
        endpoint: 'users.list',
        params: {
          limit: '200',
          ...(input.cursor && { cursor: input.cursor }),
        },
        retries: 3,
      };

      const response = await platformProxy.get(config);

      if (!response.data || !response.data.members) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: 'Unexpected API response: missing members data',
        });
      }

      const members = response.data.members.map((member: any) => ({
        id: member.id,
        team_id: member.team_id,
        name: member.name,
        deleted: member.deleted,
        real_name: member.real_name ?? undefined,
        profile: {
          real_name: member.profile?.real_name ?? undefined,
          display_name: member.profile?.display_name ?? undefined,
          email: member.profile?.email ?? undefined,
          avatar_hash: member.profile?.avatar_hash ?? undefined,
          image_24: member.profile?.image_24 ?? undefined,
          image_32: member.profile?.image_32 ?? undefined,
          image_48: member.profile?.image_48 ?? undefined,
          image_72: member.profile?.image_72 ?? undefined,
          image_192: member.profile?.image_192 ?? undefined,
          image_512: member.profile?.image_512 ?? undefined,
        },
        is_admin: member.is_admin ?? false,
        is_owner: member.is_owner ?? false,
        is_bot: member.is_bot ?? false,
        updated: member.updated ?? 0,
      }));

      return {
        items: members,
        next_cursor: response.data.response_metadata?.next_cursor || undefined,
      };
    },
  });
}
