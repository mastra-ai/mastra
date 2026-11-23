// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

/** Fills x-next-page from the Link header when GitLab sends only Link (keyset pagination, large result sets). */
function fillGitLabNextPage(headers: Record<string, string>): void {
  if (headers['x-next-page']) return;
  const next = /<([^>]+)>;\s*rel="next"/.exec(headers['link'] ?? '')?.[1];
  const page = next ? new URL(next).searchParams.get('page') : null;
  if (page) headers['x-next-page'] = page;
}

export const listGroupsInputSchema = z.object({
  cursor: z
    .string()
    .regex(/^[1-9]\d*$/, 'cursor must be the page number from next_cursor')
    .optional()
    .describe('Pagination cursor (page number). Omit for the first page.'),
  search: z.string().optional().describe('Search query to filter groups.'),
  owned: z.boolean().optional().describe('Limit to groups explicitly owned by the current user.'),
  min_access_level: z.number().optional().describe('Minimum access level of the authenticated user.'),
  top_level_only: z.boolean().optional().describe('Limit to top level groups only.'),
  per_page: z.number().optional().describe('Number of results to return per page.'),
});

const ProviderGroupSchema = z.object({
  id: z.number(),
  name: z.string(),
  path: z.string(),
  description: z.string().nullable().optional(),
  visibility: z.string().optional(),
  web_url: z.string().optional(),
  full_name: z.string().optional(),
  full_path: z.string().optional(),
  parent_id: z.number().nullable().optional(),
  created_at: z.string().optional(),
});

const GroupSchema = z.object({
  id: z.number(),
  name: z.string(),
  path: z.string(),
  description: z.string().optional(),
  visibility: z.string().optional(),
  web_url: z.string().optional(),
  full_name: z.string().optional(),
  full_path: z.string().optional(),
  parent_id: z.number().optional(),
  created_at: z.string().optional(),
});

export const listGroupsOutputSchema = z.object({
  items: z.array(GroupSchema),
  next_cursor: z.string().optional(),
});

export function listGroupsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_list_groups',
    description: 'List groups from GitLab.',
    inputSchema: listGroupsInputSchema,
    outputSchema: listGroupsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listGroupsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.gitlab.com/api/groups/#list-groups
      const response = await platformProxy.get({
        endpoint: '/api/v4/groups',
        params: {
          ...(input.cursor !== undefined && { page: input.cursor }),
          ...(input.search !== undefined && { search: input.search }),
          ...(input.owned !== undefined && { owned: String(input.owned) }),
          ...(input.min_access_level !== undefined && { min_access_level: String(input.min_access_level) }),
          ...(input.top_level_only !== undefined && { top_level_only: String(input.top_level_only) }),
          ...(input.per_page !== undefined && { per_page: String(input.per_page) }),
        },
        retries: 3,
      });
      fillGitLabNextPage(response.headers);

      const providerGroups = z.array(ProviderGroupSchema).parse(response.data);

      const items = providerGroups.map(group => ({
        id: group.id,
        name: group.name,
        path: group.path,
        ...(group.description != null && { description: group.description }),
        ...(group.visibility !== undefined && { visibility: group.visibility }),
        ...(group.web_url !== undefined && { web_url: group.web_url }),
        ...(group.full_name !== undefined && { full_name: group.full_name }),
        ...(group.full_path !== undefined && { full_path: group.full_path }),
        ...(group.parent_id != null && { parent_id: group.parent_id }),
        ...(group.created_at !== undefined && { created_at: group.created_at }),
      }));

      const nextPageHeader = response.headers['x-next-page'];
      const next_cursor = typeof nextPageHeader === 'string' && nextPageHeader.length > 0 ? nextPageHeader : undefined;

      return {
        items,
        ...(next_cursor !== undefined && { next_cursor }),
      };
    },
  });
}
