// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const searchRepositoriesInputSchema = z.object({
  q: z
    .string()
    .min(1)
    .describe(
      'GitHub search query. Supports qualifiers like org:mastra-ai, user:someone, language:typescript, topic:ai. Example: "org:mastra-ai mastra in:name".',
    ),
  sort: z
    .enum(['stars', 'forks', 'help-wanted-issues', 'updated'])
    .optional()
    .describe('What to sort results by. Default: best match.'),
  order: z.enum(['asc', 'desc']).optional().describe('The direction to sort the results by. Default: desc.'),
  per_page: z.number().int().min(1).max(100).optional().describe('The number of results per page (max 100).'),
  cursor: z
    .string()
    .regex(/^\d+$/, 'Cursor must be a page number.')
    .optional()
    .describe('Pagination cursor (page number). Omit for the first page.'),
});

const SearchRepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  owner_login: z.string().optional(),
  html_url: z.string(),
  description: z.string().nullable().optional(),
  private: z.boolean(),
  fork: z.boolean(),
  archived: z.boolean().optional(),
  language: z.string().nullable().optional(),
  default_branch: z.string().optional(),
  stargazers_count: z.number().optional(),
  forks_count: z.number().optional(),
  open_issues_count: z.number().optional(),
  updated_at: z.string().optional(),
});

export const searchRepositoriesOutputSchema = z.object({
  total_count: z.number(),
  incomplete_results: z.boolean(),
  items: z.array(SearchRepositorySchema),
  next_cursor: z.string().optional(),
});

export function searchRepositoriesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_search_repositories',
    description:
      'Search repositories across GitHub by name, organization, language, or topic instead of needing to know the exact owner/repo up front.',
    inputSchema: searchRepositoriesInputSchema,
    outputSchema: searchRepositoriesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchRepositoriesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const page = input.cursor ? Number.parseInt(input.cursor, 10) : 1;
      const perPage = input.per_page ?? 30;

      // https://docs.github.com/en/rest/search/search#search-repositories
      const response = await platformProxy.get({
        endpoint: 'search/repositories',
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
        name: item.name,
        full_name: item.full_name,
        owner_login: item.owner?.login ?? undefined,
        html_url: item.html_url,
        description: item.description ?? undefined,
        private: item.private ?? false,
        fork: item.fork ?? false,
        archived: item.archived,
        language: item.language ?? undefined,
        default_branch: item.default_branch,
        stargazers_count: item.stargazers_count,
        forks_count: item.forks_count,
        open_issues_count: item.open_issues_count,
        updated_at: item.updated_at,
      }));

      // GitHub's search API only exposes the first 1,000 results; never emit
      // a cursor pointing past that window.
      const reachableResults = Math.min(data.total_count ?? 0, 1000);
      const hasMore = page * perPage < reachableResults && items.length === perPage;

      return {
        total_count: data.total_count ?? 0,
        incomplete_results: data.incomplete_results ?? false,
        items,
        ...(hasMore && { next_cursor: String(page + 1) }),
      };
    },
  });
}
