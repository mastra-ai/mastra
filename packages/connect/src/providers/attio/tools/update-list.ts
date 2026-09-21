// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateListInputSchema = z.object({
  list_id: z
    .string()
    .describe('A UUID or slug to identify the list to update. Example: "33ebdbe9-e529-47c9-b894-0ba25e9c15c0"'),
  name: z.string().optional().describe('The human-readable name of the list.'),
  api_slug: z
    .string()
    .optional()
    .describe('A unique, human-readable slug to access the list through API calls. Should be formatted in snake case.'),
  workspace_access: z
    .enum(['full-access', 'read-and-write', 'read-only'])
    .nullable()
    .optional()
    .describe(
      'The level of access granted to all members of the workspace for this list. Pass null to keep the list private.',
    ),
  workspace_member_access: z
    .array(
      z.object({
        workspace_member_id: z.string().describe('A UUID to identify the workspace member to grant access to.'),
        level: z.enum(['full-access', 'read-and-write', 'read-only']).describe('The level of access to the list.'),
      }),
    )
    .optional()
    .describe(
      'The level of access granted to specific workspace members for this list. Pass an empty array to grant access to no workspace members.',
    ),
});

const WorkspaceMemberAccessSchema = z.object({
  workspace_member_id: z.string(),
  level: z.enum(['full-access', 'read-and-write', 'read-only']).or(z.string()),
});

const CreatedByActorSchema = z.object({
  id: z.string().nullable(),
  type: z.enum(['api-token', 'workspace-member', 'system', 'app']).or(z.string()).nullable(),
});

const ListIdSchema = z.object({
  workspace_id: z.string(),
  list_id: z.string(),
});

const ProviderListSchema = z.object({
  id: ListIdSchema,
  api_slug: z.string(),
  name: z.string(),
  parent_object: z.array(z.string()),
  workspace_access: z.string().nullable(),
  workspace_member_access: z.array(WorkspaceMemberAccessSchema),
  created_by_actor: CreatedByActorSchema,
  created_at: z.string(),
});

export const updateListOutputSchema = z.object({
  id: ListIdSchema,
  api_slug: z.string(),
  name: z.string(),
  parent_object: z.array(z.string()),
  workspace_access: z.string().nullable().optional(),
  workspace_member_access: z.array(WorkspaceMemberAccessSchema).optional(),
  created_by_actor: CreatedByActorSchema.optional(),
  created_at: z.string().optional(),
});

export function updateListTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_update_list',
    description: 'Update a list in Attio.',
    inputSchema: updateListInputSchema,
    outputSchema: updateListOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateListOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.patch({
        // https://docs.attio.com/rest-api/endpoint-reference/lists/update-a-list
        endpoint: `/v2/lists/${input.list_id}`,
        data: {
          data: {
            ...(input.name !== undefined && { name: input.name }),
            ...(input.api_slug !== undefined && { api_slug: input.api_slug }),
            ...(input.workspace_access !== undefined && { workspace_access: input.workspace_access }),
            ...(input.workspace_member_access !== undefined && {
              workspace_member_access: input.workspace_member_access,
            }),
          },
        },
        retries: 3,
      });

      const providerResponse = z
        .object({
          data: ProviderListSchema,
        })
        .parse(response.data);

      const list = providerResponse.data;

      return {
        id: list.id,
        api_slug: list.api_slug,
        name: list.name,
        parent_object: list.parent_object,
        ...(list.workspace_access !== undefined && { workspace_access: list.workspace_access }),
        ...(list.workspace_member_access !== undefined && { workspace_member_access: list.workspace_member_access }),
        ...(list.created_by_actor !== undefined && { created_by_actor: list.created_by_actor }),
        ...(list.created_at !== undefined && { created_at: list.created_at }),
      };
    },
  });
}
