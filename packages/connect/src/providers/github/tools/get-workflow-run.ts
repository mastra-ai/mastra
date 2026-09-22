// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getWorkflowRunInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "viictoo"'),
  repo: z.string().describe('The name of the repository. Example: "api-playground2"'),
  run_id: z.number().describe('The unique identifier of the workflow run. Example: 123456789'),
  exclude_pull_requests: z.boolean().optional().describe('If true, pull requests are omitted from the response.'),
});

export const getWorkflowRunOutputSchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  node_id: z.string(),
  head_branch: z.string().nullable(),
  head_sha: z.string(),
  path: z.string(),
  run_number: z.number(),
  run_attempt: z.number().optional(),
  event: z.string(),
  status: z.string().nullable(),
  conclusion: z.string().nullable(),
  workflow_id: z.number(),
  url: z.string(),
  html_url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  run_started_at: z.string().optional(),
  jobs_url: z.string(),
  logs_url: z.string(),
  check_suite_url: z.string(),
  artifacts_url: z.string(),
  cancel_url: z.string(),
  rerun_url: z.string(),
  workflow_url: z.string(),
  display_title: z.string(),
});

export function getWorkflowRunTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_get_workflow_run',
    description: 'Retrieve a workflow run with status and conclusion details.',
    inputSchema: getWorkflowRunInputSchema,
    outputSchema: getWorkflowRunOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getWorkflowRunOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run
      const response = await platformProxy.get({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/actions/runs/${input.run_id}`,
        params: {
          ...(input.exclude_pull_requests !== undefined && {
            exclude_pull_requests: String(input.exclude_pull_requests),
          }),
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Workflow run not found',
          run_id: input.run_id,
          owner: input.owner,
          repo: input.repo,
        });
      }

      return getWorkflowRunOutputSchema.parse(response.data);
    },
  });
}
