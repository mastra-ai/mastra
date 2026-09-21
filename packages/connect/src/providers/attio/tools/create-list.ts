// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const WorkspaceMemberAccessSchema = z.object({
  workspace_member_id: z
    .string()
    .describe(
      'A UUID to identify the workspace member to grant access to. Example: "50cf242c-7fa3-4cad-87d0-75b1af71c57b"',
    ),
  level: z.enum(['full-access', 'read-and-write', 'read-only']).describe('The level of access to the list.'),
});

export const createListInputSchema = z.object({
  name: z.string().describe('The human-readable name of the list. Example: "Enterprise Sales"'),
  api_slug: z
    .string()
    .describe(
      'A unique, human-readable slug to access the list through API calls. Should be formatted in snake case. Example: "enterprise_sales"',
    ),
  parent_object: z
    .string()
    .describe('A UUID or slug to identify the allowed object type for records added to this list. Example: "people"'),
  workspace_access: z
    .enum(['full-access', 'read-and-write', 'read-only'])
    .nullable()
    .describe(
      'The level of access granted to all members of the workspace for this list. Pass null to keep the list private.',
    ),
  workspace_member_access: z
    .array(WorkspaceMemberAccessSchema)
    .describe(
      'The level of access granted to specific workspace members for this list. Pass an empty array to grant access to no workspace members.',
    ),
});

const ProviderListIdSchema = z.object({
  workspace_id: z.string(),
  list_id: z.string(),
});

const ProviderCreatedByActorSchema = z.object({
  id: z.string().nullable(),
  type: z.enum(['api-token', 'workspace-member', 'system', 'app']).or(z.string()).nullable(),
});

const ProviderListSchema = z.object({
  id: ProviderListIdSchema,
  api_slug: z.string(),
  name: z.string(),
  parent_object: z.array(z.string()),
  workspace_access: z.enum(['full-access', 'read-and-write', 'read-only']).or(z.string()).nullable(),
  workspace_member_access: z.array(WorkspaceMemberAccessSchema),
  created_by_actor: ProviderCreatedByActorSchema,
  created_at: z.string(),
});

export const createListOutputSchema = z.object({
  id: ProviderListIdSchema,
  api_slug: z.string(),
  name: z.string(),
  parent_object: z.array(z.string()),
  workspace_access: z.enum(['full-access', 'read-and-write', 'read-only']).or(z.string()).nullable().optional(),
  workspace_member_access: z.array(WorkspaceMemberAccessSchema).optional(),
  created_by_actor: ProviderCreatedByActorSchema.optional(),
  created_at: z.string().optional(),
});

export function createListTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_create_list',
    description: 'Create a list in Attio.',
    inputSchema: createListInputSchema,
    outputSchema: createListOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createListOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.attio.com/rest-api/endpoint-reference/lists/create-a-list
      const response = await platformProxy.post({
        endpoint: '/v2/lists',
        data: {
          data: {
            name: input.name,
            api_slug: input.api_slug,
            parent_object: input.parent_object,
            workspace_access: input.workspace_access,
            workspace_member_access: input.workspace_member_access,
          },
        },
        retries: 3,
      });

      const providerList = ProviderListSchema.parse(response.data.data);

      return {
        id: providerList.id,
        api_slug: providerList.api_slug,
        name: providerList.name,
        parent_object: providerList.parent_object,
        workspace_member_access: providerList.workspace_member_access,
        ...(providerList.workspace_access !== null && { workspace_access: providerList.workspace_access }),
        created_by_actor: providerList.created_by_actor,
        created_at: providerList.created_at,
      };
    },
  });
}
