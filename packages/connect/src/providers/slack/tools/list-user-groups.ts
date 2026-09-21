// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const UserGroupSchema = z.object({
  id: z.string(),
  team_id: z.string(),
  is_usergroup: z.boolean(),
  name: z.string(),
  description: z.string().optional(),
  handle: z.string(),
  is_external: z.boolean(),
  date_create: z.number(),
  date_update: z.number(),
  date_delete: z.number(),
  auto_type: z.string().optional(),
  created_by: z.string(),
  updated_by: z.string().optional(),
  deleted_by: z.string().optional(),
  prefs: z.object({
    channels: z.array(z.string()),
    groups: z.array(z.string()),
  }),
  user_count: z.number().optional(),
  users: z.array(z.string()).optional(),
});

export const listUserGroupsInputSchema = z.object({
  include_disabled: z.boolean().optional().describe('Include results for disabled User Groups'),
  include_count: z.boolean().optional().describe('Include the number of users in each User Group'),
  include_users: z.boolean().optional().describe('Include the list of users for each User Group'),
});

export const listUserGroupsOutputSchema = z.object({
  usergroups: z.array(UserGroupSchema),
});

export function listUserGroupsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_list_user_groups',
    description: 'List workspace user groups with optional disabled and membership counts',
    inputSchema: listUserGroupsInputSchema,
    outputSchema: listUserGroupsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listUserGroupsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.slack.dev/reference/methods/usergroups.list
      const response = await platformProxy.get({
        endpoint: 'usergroups.list',
        params: {
          ...(input.include_disabled && { include_disabled: input.include_disabled.toString() }),
          ...(input.include_count && { include_count: input.include_count.toString() }),
          ...(input.include_users && { include_users: input.include_users.toString() }),
        },
        retries: 3,
      });

      if (!response.data?.ok) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: response.data?.error || 'Failed to list user groups',
          response: response.data,
        });
      }

      return {
        usergroups: response.data.usergroups || [],
      };
    },
  });
}
