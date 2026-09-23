// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listUserGroupsInputSchema = z.object({
  mine: z.boolean().optional().describe('If true, returns only user groups the current user belongs to.'),
});

const UserGroupMemberSchema = z.object({
  user_id: z.string(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().optional(),
});

const UserGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  handle: z.string().optional(),
  members: z.array(UserGroupMemberSchema).optional(),
});

const GraphQlResponseSchema = z.object({
  data: z.object({
    user_groups: z.array(z.unknown()),
  }),
});

export const listUserGroupsOutputSchema = z.object({
  user_groups: z.array(UserGroupSchema),
});

export function listUserGroupsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_list_user_groups',
    description: 'List user groups, optionally filtered to mine.',
    inputSchema: listUserGroupsInputSchema,
    outputSchema: listUserGroupsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listUserGroupsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.fireflies.ai/graphql-api/query/user-groups
        endpoint: '/graphql',
        data: {
          query: `
                    query UserGroups($mine: Boolean) {
                        user_groups(mine: $mine) {
                            id
                            name
                            handle
                            members {
                                user_id
                                first_name
                                last_name
                                email
                            }
                        }
                    }
                `,
          variables: {
            ...(input.mine !== undefined && { mine: input.mine }),
          },
        },
        retries: 3,
      });

      const parsedResponse = GraphQlResponseSchema.parse(response.data);
      const userGroups = parsedResponse.data.user_groups.map(group => {
        return UserGroupSchema.parse(group);
      });

      return {
        user_groups: userGroups,
      };
    },
  });
}
