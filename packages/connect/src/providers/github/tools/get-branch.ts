// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getBranchInputSchema = z.object({
  owner: z.string().describe('Repository owner. Example: "octocat"'),
  repo: z.string().describe('Repository name. Example: "Hello-World"'),
  branch: z.string().describe('Branch name. Example: "main"'),
});

const ProviderCommitSchema = z.object({
  sha: z.string(),
  url: z.string().optional(),
  node_id: z.string().optional(),
});

const ProviderProtectionRequiredStatusCheckSchema = z
  .object({
    enforcement_level: z.string().optional(),
    contexts: z.array(z.string()).optional(),
    checks: z.array(z.unknown()).optional(),
  })
  .passthrough();

const ProviderProtectionSchema = z
  .object({
    enabled: z.boolean().optional(),
    required_status_checks: ProviderProtectionRequiredStatusCheckSchema.optional().nullable(),
    enforce_admins: z.unknown().optional().nullable(),
    required_pull_request_reviews: z.unknown().optional().nullable(),
    restrictions: z.unknown().optional().nullable(),
  })
  .passthrough();

const ProviderBranchSchema = z
  .object({
    name: z.string(),
    commit: ProviderCommitSchema,
    protected: z.boolean().optional(),
    protection: ProviderProtectionSchema.optional().nullable(),
    protection_url: z.string().optional(),
  })
  .passthrough();

export const getBranchOutputSchema = z.object({
  name: z.string(),
  commit_sha: z.string(),
  protected: z.boolean().optional(),
  protection: z.unknown().optional(),
});

export function getBranchTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_get_branch',
    description: 'Retrieve branch metadata and protection status.',
    inputSchema: getBranchInputSchema,
    outputSchema: getBranchOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getBranchOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/branches/branches#get-a-branch
      const response = await platformProxy.get({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/branches/${encodeURIComponent(input.branch)}`,
        retries: 3,
      });

      const branch = ProviderBranchSchema.parse(response.data);

      return {
        name: branch.name,
        commit_sha: branch.commit.sha,
        protected: branch.protected,
        ...(branch.protection && { protection: branch.protection }),
      };
    },
  });
}
