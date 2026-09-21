// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createBranchInputSchema = z.object({
  owner: z.string().describe('Repository owner. Example: "viictoo"'),
  repo: z.string().describe('Repository name. Example: "api-playground2"'),
  branch: z.string().describe('Name of the new branch. Example: "feature-branch"'),
  sha: z.string().describe('The SHA of the commit to create the branch from. Example: "abc123def..."'),
});

const ProviderRefSchema = z.object({
  ref: z.string(),
  node_id: z.string(),
  url: z.string(),
  object: z.object({
    type: z.string(),
    sha: z.string(),
    url: z.string(),
  }),
});

export const createBranchOutputSchema = z.object({
  ref: z.string().describe('The Git reference. Example: "refs/heads/feature-branch"'),
  sha: z.string().describe('The SHA of the referenced object'),
  type: z.string().describe('Type of the referenced object. Example: "commit"'),
});

export function createBranchTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_create_branch',
    description: 'Create a branch ref from an existing commit SHA',
    inputSchema: createBranchInputSchema,
    outputSchema: createBranchOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createBranchOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/git/refs#create-a-reference
      const response = await platformProxy.post({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/refs`,
        data: {
          ref: `refs/heads/${input.branch}`,
          sha: input.sha,
        },
        retries: 10,
      });

      const providerRef = ProviderRefSchema.parse(response.data);

      return {
        ref: providerRef.ref,
        sha: providerRef.object.sha,
        type: providerRef.object.type,
      };
    },
  });
}
