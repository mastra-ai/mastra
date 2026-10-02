// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listWorkflowRunsInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "octocat"'),
  repo: z.string().describe('The name of the repository. Example: "hello-world"'),
  workflow_id: z
    .union([z.string(), z.number()])
    .optional()
    .describe(
      'The ID of the workflow. Example: "161335" or "main.yml". If provided, only runs for this workflow are returned.',
    ),
  status: z
    .enum([
      'queued',
      'in_progress',
      'completed',
      'waiting',
      'requested',
      'pending',
      'action_required',
      'cancelled',
      'failure',
      'neutral',
      'skipped',
      'stale',
      'success',
      'timed_out',
    ])
    .optional()
    .describe('Returns workflow runs with the specified status or conclusion.'),
  branch: z.string().optional().describe('Returns workflow runs triggered on the specified branch.'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('The number of results per page (max 100). Default: 30.'),
});

const WorkflowRunSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  node_id: z.string(),
  head_branch: z.string().optional(),
  head_sha: z.string().optional(),
  path: z.string().optional(),
  run_number: z.number().optional(),
  event: z.string().optional(),
  status: z.string().optional(),
  conclusion: z.string().nullable().optional(),
  workflow_id: z.number().optional(),
  url: z.string().optional(),
  html_url: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  run_started_at: z.string().optional(),
});

const ProviderResponseSchema = z.object({
  total_count: z.number(),
  workflow_runs: z.array(WorkflowRunSchema),
});

export const listWorkflowRunsOutputSchema = z.object({
  runs: z.array(WorkflowRunSchema),
  total_count: z.number(),
  next_cursor: z.string().optional(),
});

export function listWorkflowRunsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_list_workflow_runs',
    description: 'List workflow runs for a repository or a specific workflow',
    inputSchema: listWorkflowRunsInputSchema,
    outputSchema: listWorkflowRunsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listWorkflowRunsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      let page = 1;
      if (input.cursor) {
        if (!/^\d+$/.test(input.cursor)) {
          throw new platformProxy.ActionError({
            type: 'invalid_cursor',
            message: 'Invalid cursor format. Cursor must be a positive integer page number.',
          });
        }
        page = parseInt(input.cursor, 10);
        if (page < 1) {
          throw new platformProxy.ActionError({
            type: 'invalid_cursor',
            message: 'Invalid cursor format. Cursor must be a positive integer page number.',
          });
        }
      }

      const perPage = input.per_page ?? 30;
      const params: Record<string, string | number> = {
        page: page,
        per_page: perPage,
        ...(input.status !== undefined && { status: input.status }),
        ...(input.branch !== undefined && { branch: input.branch }),
      };

      let endpoint: string;

      if (input.workflow_id) {
        endpoint = `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/actions/workflows/${encodeURIComponent(String(input.workflow_id))}/runs`;
      } else {
        endpoint = `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/actions/runs`;
      }

      // https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-repository
      // https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow
      const response = await platformProxy.get({
        endpoint: endpoint,
        params: params,
        retries: 3,
      });

      if (response.status !== 200 || !response.data) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: `Failed to list workflow runs: ${response.status}`,
          status: response.status,
        });
      }

      const providerData = ProviderResponseSchema.parse(response.data);

      const runs = providerData.workflow_runs;
      const hasMorePages = runs.length === perPage;
      const nextPage = hasMorePages ? page + 1 : undefined;

      return {
        total_count: providerData.total_count,
        runs: runs.map(run => ({
          id: run.id,
          ...(run.name !== undefined && { name: run.name }),
          node_id: run.node_id,
          ...(run.head_branch !== undefined && { head_branch: run.head_branch }),
          ...(run.head_sha !== undefined && { head_sha: run.head_sha }),
          ...(run.path !== undefined && { path: run.path }),
          ...(run.run_number !== undefined && { run_number: run.run_number }),
          ...(run.event !== undefined && { event: run.event }),
          ...(run.status !== undefined && { status: run.status }),
          ...(run.conclusion !== undefined && {
            conclusion: run.conclusion,
          }),
          ...(run.workflow_id !== undefined && { workflow_id: run.workflow_id }),
          ...(run.url !== undefined && { url: run.url }),
          ...(run.html_url !== undefined && { html_url: run.html_url }),
          ...(run.created_at !== undefined && { created_at: run.created_at }),
          ...(run.updated_at !== undefined && { updated_at: run.updated_at }),
          ...(run.run_started_at !== undefined && { run_started_at: run.run_started_at }),
        })),
        ...(nextPage !== undefined && { next_cursor: String(nextPage) }),
      };
    },
  });
}
