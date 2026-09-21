// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listWorkflowsInputSchema = z.object({
  owner: z.string().describe('Repository owner. Example: "octocat"'),
  repo: z.string().describe('Repository name. Example: "hello-world"'),
  per_page: z.number().int().min(1).max(100).optional().describe('Number of results per page (max 100).'),
  page: z.number().int().min(1).optional().describe('Page number of the results to fetch.'),
});

const WorkflowSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  name: z.string(),
  path: z.string(),
  state: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  url: z.string(),
  html_url: z.string(),
  badge_url: z.string(),
});

export const listWorkflowsOutputSchema = z.object({
  total_count: z.number(),
  workflows: z.array(WorkflowSchema),
});

export function listWorkflowsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_list_workflows',
    description: 'List GitHub Actions workflows configured in a repository.',
    inputSchema: listWorkflowsInputSchema,
    outputSchema: listWorkflowsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listWorkflowsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/actions/workflows?apiVersion=2022-11-28#list-repository-workflows
      const response = await platformProxy.get({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/actions/workflows`,
        params: {
          ...(input.per_page !== undefined && { per_page: String(input.per_page) }),
          ...(input.page !== undefined && { page: String(input.page) }),
        },
        retries: 3,
      });

      const providerData = z
        .object({
          total_count: z.number(),
          workflows: z.array(WorkflowSchema),
        })
        .parse(response.data);

      return {
        total_count: providerData.total_count,
        workflows: providerData.workflows,
      };
    },
  });
}
