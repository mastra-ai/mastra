// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getTreeInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "viictoo"'),
  repo: z.string().describe('The name of the repository without the .git extension. Example: "api-playground2"'),
  tree_sha: z.string().describe('The SHA1 value or ref (branch or tag) name of the tree. Example: "main"'),
  recursive: z
    .boolean()
    .optional()
    .describe(
      'Setting to true returns the objects or subtrees referenced by the tree. Omit for the top-level tree only.',
    ),
});

const TreeEntrySchema = z.object({
  path: z.string(),
  mode: z.string(),
  type: z.enum(['blob', 'tree', 'commit']).or(z.string()),
  sha: z.string(),
  size: z.number().optional(),
  url: z.string().optional(),
});

export const getTreeOutputSchema = z.object({
  sha: z.string(),
  url: z.string().optional(),
  tree: z.array(TreeEntrySchema),
  truncated: z.boolean(),
});

export function getTreeTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_get_tree',
    description:
      'Get a git tree for a repository, optionally recursively, listing the files and directories it contains.',
    inputSchema: getTreeInputSchema,
    outputSchema: getTreeOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getTreeOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/git/trees#get-a-tree
      const response = await platformProxy.get({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/trees/${encodeURIComponent(input.tree_sha)}`,
        params: {
          ...(input.recursive && { recursive: '1' }),
        },
        retries: 3,
      });

      if (response.status === 404) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Tree not found',
          owner: input.owner,
          repo: input.repo,
          tree_sha: input.tree_sha,
        });
      }

      const tree = getTreeOutputSchema.parse(response.data);

      return tree;
    },
  });
}
