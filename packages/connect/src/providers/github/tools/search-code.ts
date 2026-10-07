// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const searchCodeInputSchema = z.object({
  q: z
    .string()
    .min(1)
    .describe(
      'GitHub code search query. Must include at least one qualifier such as repo:owner/name, org:name, or user:name. Example: "createTool repo:mastra-ai/mastra language:typescript".',
    ),
  per_page: z.number().int().min(1).max(100).optional().describe('The number of results per page (max 100).'),
  cursor: z
    .string()
    .regex(/^\d+$/, 'Cursor must be a page number.')
    .optional()
    .describe('Pagination cursor (page number). Omit for the first page.'),
});

const SearchCodeItemSchema = z.object({
  name: z.string(),
  path: z.string(),
  sha: z.string(),
  html_url: z.string(),
  repository_full_name: z.string().optional(),
});

export const searchCodeOutputSchema = z.object({
  total_count: z.number(),
  incomplete_results: z.boolean(),
  items: z.array(SearchCodeItemSchema),
  next_cursor: z.string().optional(),
});

export function searchCodeTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_search_code',
    description:
      'Search file contents across GitHub repositories. The query must be scoped with a repo:, org:, or user: qualifier.',
    inputSchema: searchCodeInputSchema,
    outputSchema: searchCodeOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchCodeOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const page = input.cursor ? Number.parseInt(input.cursor, 10) : 1;
      const perPage = input.per_page ?? 30;

      // https://docs.github.com/en/rest/search/search#search-code
      const response = await platformProxy.get({
        endpoint: 'search/code',
        params: {
          q: input.q,
          per_page: perPage,
          page,
        },
        retries: 3,
      });

      const data = response.data;
      const items = (data.items || []).map((item: any) => ({
        name: item.name,
        path: item.path,
        sha: item.sha,
        html_url: item.html_url,
        repository_full_name: item.repository?.full_name ?? undefined,
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
