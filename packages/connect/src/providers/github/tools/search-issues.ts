// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const searchIssuesInputSchema = z.object({
  q: z
    .string()
    .min(1)
    .describe(
      'GitHub search query. Supports qualifiers like repo:owner/name, is:issue, is:pr, is:open, label:bug, author:user. Example: "repo:mastra-ai/mastra is:issue is:open label:bug".',
    ),
  sort: z
    .enum(['comments', 'reactions', 'created', 'updated'])
    .optional()
    .describe('What to sort results by. Default: best match.'),
  order: z.enum(['asc', 'desc']).optional().describe('The direction to sort the results by. Default: desc.'),
  per_page: z.number().int().min(1).max(100).optional().describe('The number of results per page (max 100).'),
  cursor: z.string().optional().describe('Pagination cursor (page number). Omit for the first page.'),
});

const SearchIssueSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  state: z.string(),
  html_url: z.string(),
  repository_url: z.string(),
  user_login: z.string().optional(),
  labels: z.array(z.string()),
  is_pull_request: z.boolean(),
  comments: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const searchIssuesOutputSchema = z.object({
  total_count: z.number(),
  incomplete_results: z.boolean(),
  items: z.array(SearchIssueSchema),
  next_cursor: z.string().optional(),
});

export function searchIssuesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_search_issues',
    description:
      'Search issues and pull requests across GitHub with the search API instead of paging repository listings. Supports the full GitHub search query syntax.',
    inputSchema: searchIssuesInputSchema,
    outputSchema: searchIssuesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchIssuesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const page = input.cursor ? Number.parseInt(input.cursor, 10) : 1;
      const perPage = input.per_page ?? 30;

      // https://docs.github.com/en/rest/search/search#search-issues-and-pull-requests
      const response = await platformProxy.get({
        endpoint: 'search/issues',
        params: {
          q: input.q,
          ...(input.sort !== undefined && { sort: input.sort }),
          ...(input.order !== undefined && { order: input.order }),
          per_page: perPage,
          page,
        },
        retries: 3,
      });

      const data = response.data;
      const items = (data.items || []).map((item: any) => ({
        id: item.id,
        number: item.number,
        title: item.title,
        state: item.state,
        html_url: item.html_url,
        repository_url: item.repository_url,
        user_login: item.user?.login ?? undefined,
        labels: (item.labels || []).map((label: any) => (typeof label === 'string' ? label : label.name || '')),
        is_pull_request: item.pull_request !== undefined,
        comments: item.comments ?? 0,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));

      const hasMore = page * perPage < (data.total_count ?? 0) && items.length === perPage;

      return {
        total_count: data.total_count ?? 0,
        incomplete_results: data.incomplete_results ?? false,
        items,
        ...(hasMore && { next_cursor: String(page + 1) }),
      };
    },
  });
}
