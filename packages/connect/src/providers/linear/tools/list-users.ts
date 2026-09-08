// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listUsersInputSchema = z.object({
  first: z
    .number()
    .int()
    .min(1)
    .max(250)
    .optional()
    .describe('The number of items to return per page. Max 250. Example: 50'),
  after: z.string().optional().describe('Pagination cursor from the previous response. Example: "abc123"'),
  orderBy: z
    .string()
    .optional()
    .describe('Order by field. Available options are createdAt (default) and updatedAt. Example: "updatedAt"'),
  filter: z
    .object({
      active: z.boolean().optional().describe('Filter by user active state. Example: true'),
    })
    .optional()
    .describe('Filter options for users'),
  includeDisabled: z.boolean().optional().describe('Include disabled/suspended users (default: false). Example: true'),
});

const GraphQLErrorSchema = z
  .object({
    message: z.string(),
  })
  .passthrough();

const GraphQLResponseSchema = z.object({
  data: z
    .object({
      users: z
        .object({
          nodes: z.array(z.unknown()),
          pageInfo: z.object({
            hasNextPage: z.boolean(),
            endCursor: z.string().nullable().optional(),
          }),
        })
        .optional(),
    })
    .optional(),
  errors: z.array(GraphQLErrorSchema).optional(),
});

const UserNodeSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  active: z.boolean().optional(),
  admin: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  lastSeen: z.string().nullable().optional(),
});

export const listUsersOutputSchema = z.object({
  users: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      email: z.string().optional(),
      active: z.boolean().optional(),
      admin: z.boolean().optional(),
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
      lastSeen: z.string().optional(),
    }),
  ),
  nextCursor: z.string().optional(),
});

export function listUsersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_list_users',
    description: 'List Linear users with filtering and pagination.',
    inputSchema: listUsersInputSchema,
    outputSchema: listUsersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listUsersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const variables: Record<string, unknown> = {};
      if (input.first !== undefined) {
        variables['first'] = input.first;
      }
      if (input.after !== undefined) {
        variables['after'] = input.after;
      }
      if (input.orderBy !== undefined) {
        variables['orderBy'] = input.orderBy;
      }
      if (input.includeDisabled !== undefined) {
        variables['includeDisabled'] = input.includeDisabled;
      }
      if (input.filter !== undefined && input.filter.active !== undefined) {
        variables['filter'] = {
          active: {
            eq: input.filter.active,
          },
        };
      }

      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query:
            'query Users($first: Int, $after: String, $orderBy: PaginationOrderBy, $filter: UserFilter, $includeDisabled: Boolean) { users(first: $first, after: $after, orderBy: $orderBy, filter: $filter, includeDisabled: $includeDisabled) { nodes { id name email active admin createdAt updatedAt lastSeen } pageInfo { hasNextPage endCursor } } }',
          variables,
        },
        retries: 3,
      });

      const raw = GraphQLResponseSchema.parse(response.data);
      if (raw.errors && raw.errors.length > 0) {
        throw new platformProxy.ActionError({
          type: 'graphql_error',
          message: raw.errors.map(e => e.message).join(', '),
        });
      }
      if (!raw.data || !raw.data.users) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid or missing users data in Linear API response.',
        });
      }

      const users = raw.data.users.nodes.map(node => {
        const user = UserNodeSchema.parse(node);
        return {
          id: user.id,
          ...(user.name !== undefined && { name: user.name }),
          ...(user.email !== undefined && { email: user.email }),
          ...(user.active !== undefined && { active: user.active }),
          ...(user.admin !== undefined && { admin: user.admin }),
          ...(user.createdAt !== undefined && { createdAt: user.createdAt }),
          ...(user.updatedAt !== undefined && { updatedAt: user.updatedAt }),
          ...(user.lastSeen !== null && user.lastSeen !== undefined && { lastSeen: user.lastSeen }),
        };
      });

      return {
        users,
        ...(raw.data.users.pageInfo.endCursor != null &&
          raw.data.users.pageInfo.hasNextPage && {
            nextCursor: raw.data.users.pageInfo.endCursor,
          }),
      };
    },
  });
}
