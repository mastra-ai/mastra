// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

/** Encodes one GitLab path segment exactly once, whether `value` arrives raw or already URL-encoded. */
function gitlabPathSegment(value: string | number): string {
  const text = String(value);
  try {
    return encodeURIComponent(decodeURIComponent(text));
  } catch {
    return encodeURIComponent(text);
  }
}

export const createIssueInputSchema = z.object({
  project_id: z
    .union([
      z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      z
        .string()
        .min(1)
        .refine(value => {
          try {
            encodeURIComponent(value);
            return true;
          } catch {
            return false;
          }
        }, 'must not contain unpaired surrogate characters'),
    ])
    .describe(
      'Numeric project ID, or the project path raw or URL-encoded. Example: 82599306, "team/app", or "team%2Fapp"',
    ),
  title: z.string().describe('The title of the issue.'),
  description: z.string().optional().describe('The description of an issue.'),
  labels: z.string().optional().describe('Comma-separated label names to assign to the new issue.'),
  confidential: z.boolean().optional().describe('Set an issue to be confidential. Default is false.'),
  assignee_ids: z.array(z.number()).optional().describe('The IDs of the users to assign the issue to.'),
  milestone_id: z.number().optional().describe('The global ID of a milestone to assign to the issue.'),
  due_date: z.string().optional().describe('The due date. Format: YYYY-MM-DD.'),
  issue_type: z
    .string()
    .optional()
    .describe('The type of issue. One of issue, incident, test_case or task. Default is issue.'),
});

const ProviderIssueSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number(),
  title: z.string(),
  description: z.string().nullable().optional(),
  state: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  labels: z.array(z.string()),
  web_url: z.string(),
  confidential: z.boolean().optional(),
});

export const createIssueOutputSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number(),
  title: z.string(),
  description: z.string().optional(),
  state: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  labels: z.array(z.string()),
  web_url: z.string(),
  confidential: z.boolean().optional(),
});

export function createIssueTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_create_issue',
    description: 'Create an issue in GitLab.',
    inputSchema: createIssueInputSchema,
    outputSchema: createIssueOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createIssueOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.gitlab.com/api/issues/#new-issue
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/issues`,
        data: {
          title: input.title,
          ...(input.description !== undefined && { description: input.description }),
          ...(input.labels !== undefined && { labels: input.labels }),
          ...(input.confidential !== undefined && { confidential: input.confidential }),
          ...(input.assignee_ids !== undefined && { assignee_ids: input.assignee_ids }),
          ...(input.milestone_id !== undefined && { milestone_id: input.milestone_id }),
          ...(input.due_date !== undefined && { due_date: input.due_date }),
          ...(input.issue_type !== undefined && { issue_type: input.issue_type }),
        },
        retries: 1,
      });

      const providerIssue = ProviderIssueSchema.parse(response.data);

      return {
        id: providerIssue.id,
        iid: providerIssue.iid,
        project_id: providerIssue.project_id,
        title: providerIssue.title,
        ...(providerIssue.description != null && { description: providerIssue.description }),
        state: providerIssue.state,
        created_at: providerIssue.created_at,
        updated_at: providerIssue.updated_at,
        labels: providerIssue.labels,
        web_url: providerIssue.web_url,
        ...(providerIssue.confidential !== undefined && { confidential: providerIssue.confidential }),
      };
    },
  });
}
