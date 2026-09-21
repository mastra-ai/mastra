// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getListInputSchema = z.object({
  list_id: z.string().describe('A UUID or slug identifying the list. Example: "39723680-f534-4fe7-ab80-c5278e20e37b"'),
});

const ListIdSchema = z.object({
  workspace_id: z.string(),
  list_id: z.string(),
});

const WorkspaceMemberAccessSchema = z.object({
  workspace_member_id: z.string(),
  level: z.enum(['full-access', 'read-and-write', 'read-only']).or(z.string()),
});

const CreatedByActorSchema = z.object({
  id: z.string().nullable().optional(),
  type: z.enum(['api-token', 'workspace-member', 'system', 'app']).or(z.string()).nullable().optional(),
});

const ProviderListSchema = z.object({
  id: ListIdSchema,
  api_slug: z.string(),
  name: z.string(),
  parent_object: z.array(z.string()),
  workspace_access: z.enum(['full-access', 'read-and-write', 'read-only']).or(z.string()).nullable(),
  workspace_member_access: z.array(WorkspaceMemberAccessSchema),
  created_by_actor: CreatedByActorSchema,
  created_at: z.string(),
});

export const getListOutputSchema = z.object({
  id: ListIdSchema,
  api_slug: z.string(),
  name: z.string(),
  parent_object: z.array(z.string()),
  workspace_access: z.enum(['full-access', 'read-and-write', 'read-only']).or(z.string()).nullable().optional(),
  workspace_member_access: z.array(WorkspaceMemberAccessSchema),
  created_by_actor: CreatedByActorSchema,
  created_at: z.string(),
});

export function getListTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_get_list',
    description: 'Retrieve a single list from Attio.',
    inputSchema: getListInputSchema,
    outputSchema: getListOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getListOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.attio.com/rest-api/endpoint-reference/lists/get-a-list
        endpoint: `/v2/lists/${input.list_id}`,
        retries: 3,
      });

      const wrapper = z.object({ data: ProviderListSchema }).parse(response.data);
      const providerList = wrapper.data;

      return {
        id: providerList.id,
        api_slug: providerList.api_slug,
        name: providerList.name,
        parent_object: providerList.parent_object,
        ...(providerList.workspace_access != null && { workspace_access: providerList.workspace_access }),
        workspace_member_access: providerList.workspace_member_access,
        created_by_actor: providerList.created_by_actor,
        created_at: providerList.created_at,
      };
    },
  });
}
