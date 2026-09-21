// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listListsInputSchema = z.object({});

const ListIdSchema = z.object({
  workspace_id: z.string(),
  list_id: z.string(),
});

const WorkspaceMemberAccessSchema = z.object({
  workspace_member_id: z.string(),
  level: z.enum(['full-access', 'read-and-write', 'read-only']).or(z.string()),
});

const CreatedByActorSchema = z.object({
  id: z.string().nullable(),
  type: z.enum(['api-token', 'workspace-member', 'system', 'app']).or(z.string()).nullable(),
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

const OutputListSchema = z.object({
  id: ListIdSchema,
  api_slug: z.string(),
  name: z.string(),
  parent_object: z.array(z.string()),
  workspace_access: z.enum(['full-access', 'read-and-write', 'read-only']).or(z.string()).nullable().optional(),
  workspace_member_access: z.array(WorkspaceMemberAccessSchema),
  created_by_actor: CreatedByActorSchema,
  created_at: z.string(),
});

export const listListsOutputSchema = z.object({
  items: z.array(OutputListSchema),
});

export function listListsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_list_lists',
    description: 'List lists from Attio.',
    inputSchema: listListsInputSchema,
    outputSchema: listListsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listListsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://docs.attio.com/rest-api/endpoint-reference/lists
        endpoint: '/v2/lists',
        retries: 3,
      };
      const response = await platformProxy.get(config);

      const providerResponse = z
        .object({
          data: z.array(ProviderListSchema),
        })
        .parse(response.data);

      return {
        items: providerResponse.data.map(list => ({
          id: list.id,
          api_slug: list.api_slug,
          name: list.name,
          parent_object: list.parent_object,
          ...(list.workspace_access !== null && { workspace_access: list.workspace_access }),
          workspace_member_access: list.workspace_member_access,
          created_by_actor: list.created_by_actor,
          created_at: list.created_at,
        })),
      };
    },
  });
}
