// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listUserGroupMembersInputSchema = z.object({
  usergroup_id: z.string().describe('The encoded ID of the User Group. Example: "S0604QSJC"'),
});

export const listUserGroupMembersOutputSchema = z.object({
  users: z.array(z.string()).describe('List of user IDs that are members of the user group'),
});

export function listUserGroupMembersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_list_user_group_members',
    description: 'List member user IDs for a specific Slack user group',
    inputSchema: listUserGroupMembersInputSchema,
    outputSchema: listUserGroupMembersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listUserGroupMembersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.com/methods/usergroups.users.list
      const response = await platformProxy.get({
        endpoint: 'usergroups.users.list',
        params: {
          usergroup: input.usergroup_id,
        },
        retries: 3,
      });

      if (!response.data?.ok) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: response.data?.error || 'Failed to list user group members',
          usergroup_id: input.usergroup_id,
        });
      }

      return {
        users: response.data.users || [],
      };
    },
  });
}
