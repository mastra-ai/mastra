// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listTagsInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "viictoo"'),
  repo: z.string().describe('The name of the repository without the .git extension. Example: "api-playground2"'),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('The number of results per page (max 100). Default: 30'),
  page: z.number().int().min(1).optional().describe('The page number of the results to fetch. Default: 1'),
});

const CommitSchema = z.object({
  sha: z.string(),
  url: z.string(),
});

const TagSchema = z.object({
  name: z.string(),
  commit: CommitSchema,
  zipball_url: z.string(),
  tarball_url: z.string(),
  node_id: z.string(),
});

export const listTagsOutputSchema = z.object({
  tags: z.array(TagSchema),
  next_page: z.number().optional(),
});

export function listTagsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_list_tags',
    description: 'List tags for a repository with optional pagination.',
    inputSchema: listTagsInputSchema,
    outputSchema: listTagsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listTagsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/repos/repos#list-repository-tags
      const response = await platformProxy.get({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/tags`,
        params: {
          ...(input.per_page !== undefined && { per_page: String(input.per_page) }),
          ...(input.page !== undefined && { page: String(input.page) }),
        },
        retries: 3,
      });

      if (response.status === 404) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Repository not found',
          owner: input.owner,
          repo: input.repo,
        });
      }

      const tags = z.array(TagSchema).parse(response.data);

      const perPage = input.per_page ?? 30;
      const currentPage = input.page ?? 1;
      const nextPage = tags.length === perPage ? currentPage + 1 : undefined;

      return {
        tags,
        ...(nextPage !== undefined && { next_page: nextPage }),
      };
    },
  });
}
