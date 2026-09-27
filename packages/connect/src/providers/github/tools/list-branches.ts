// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listBranchesInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "viictoo"'),
  repo: z.string().describe('The name of the repository without the .git extension. Example: "api-playground2"'),
  protected: z
    .boolean()
    .optional()
    .describe(
      'Setting to true returns only protected branches. Setting to false returns only unprotected branches. Omitting this parameter returns all branches.',
    ),
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

const BranchSchema = z.object({
  name: z.string(),
  commit: CommitSchema,
  protected: z.boolean(),
});

export const listBranchesOutputSchema = z.object({
  branches: z.array(BranchSchema),
  next_page: z.number().optional(),
});

export function listBranchesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_list_branches',
    description: 'List branches for a repository with optional pagination and protected filtering.',
    inputSchema: listBranchesInputSchema,
    outputSchema: listBranchesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listBranchesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/branches/branches#list-branches
      const response = await platformProxy.get({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/branches`,
        params: {
          ...(input.protected !== undefined && { protected: String(input.protected) }),
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

      const branches = z.array(BranchSchema).parse(response.data);

      const effectivePerPage = input.per_page ?? 30;
      const effectivePage = input.page ?? 1;
      const nextPage = branches.length === effectivePerPage ? effectivePage + 1 : undefined;

      return {
        branches,
        ...(nextPage !== undefined && { next_page: nextPage }),
      };
    },
  });
}
