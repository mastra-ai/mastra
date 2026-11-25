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

export const updateIssueInputSchema = z
  .object({
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
    issue_iid: z.number().describe('The internal ID of a project issue. Example: 1'),
    title: z.string().optional().describe('The title of the issue'),
    description: z.string().optional().describe('The description of the issue'),
    state_event: z
      .string()
      .optional()
      .describe('The state event of the issue. Use "close" to close or "reopen" to reopen'),
    labels: z
      .string()
      .optional()
      .describe('Comma-separated label names for the issue. Set to empty string to unassign all labels'),
    add_labels: z.string().optional().describe('Comma-separated label names to add to the issue'),
    remove_labels: z.string().optional().describe('Comma-separated label names to remove from the issue'),
    assignee_ids: z.array(z.number()).optional().describe('Array of user IDs to assign the issue to'),
    milestone_id: z.number().optional().describe('The global ID of a milestone to assign the issue to'),
    due_date: z.string().optional().describe('The due date in YYYY-MM-DD format'),
    confidential: z.boolean().optional().describe('Whether the issue is confidential'),
    discussion_locked: z.boolean().optional().describe('Whether the issue discussion is locked'),
    issue_type: z.string().optional().describe('The type of issue. One of issue, incident, test_case, or task'),
    weight: z.number().optional().describe('The weight of the issue'),
  })
  .refine(
    data =>
      Object.entries(data).some(([key, value]) => !['project_id', 'issue_iid'].includes(key) && value !== undefined),
    { message: 'Provide at least one field to update.' },
  );

const ProviderIssueSchema = z
  .object({
    iid: z.number(),
    title: z.string(),
    description: z.string().nullable(),
    state: z.string(),
    labels: z.array(z.string()),
    assignees: z.array(
      z.object({
        id: z.number(),
        username: z.string(),
        name: z.string(),
        state: z.string(),
      }),
    ),
    milestone: z
      .object({
        id: z.number(),
        title: z.string(),
      })
      .nullable(),
    due_date: z.string().nullable(),
    confidential: z.boolean().nullable(),
    discussion_locked: z.boolean().nullable(),
    issue_type: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    web_url: z.string(),
    project_id: z.number(),
  })
  .passthrough();

export const updateIssueOutputSchema = z.object({
  iid: z.number(),
  title: z.string(),
  description: z.string().optional(),
  state: z.string(),
  labels: z.array(z.string()),
  assignees: z.array(
    z.object({
      id: z.number(),
      username: z.string(),
      name: z.string(),
      state: z.string(),
    }),
  ),
  milestone: z
    .object({
      id: z.number(),
      title: z.string(),
    })
    .optional(),
  due_date: z.string().optional(),
  confidential: z.boolean().optional(),
  discussion_locked: z.boolean().optional(),
  issue_type: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  web_url: z.string(),
  project_id: z.number(),
});

export function updateIssueTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_update_issue',
    description: 'Update an issue in GitLab.',
    inputSchema: updateIssueInputSchema,
    outputSchema: updateIssueOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateIssueOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.put({
        // https://docs.gitlab.com/api/issues/#edit-an-issue
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/issues/${encodeURIComponent(String(input.issue_iid))}`,
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.state_event !== undefined && { state_event: input.state_event }),
          ...(input.labels !== undefined && { labels: input.labels }),
          ...(input.add_labels !== undefined && { add_labels: input.add_labels }),
          ...(input.remove_labels !== undefined && { remove_labels: input.remove_labels }),
          ...(input.assignee_ids !== undefined && { assignee_ids: input.assignee_ids }),
          ...(input.milestone_id !== undefined && { milestone_id: input.milestone_id }),
          ...(input.due_date !== undefined && { due_date: input.due_date }),
          ...(input.confidential !== undefined && { confidential: input.confidential }),
          ...(input.discussion_locked !== undefined && { discussion_locked: input.discussion_locked }),
          ...(input.issue_type !== undefined && { issue_type: input.issue_type }),
          ...(input.weight !== undefined && { weight: input.weight }),
        },
        retries: 1,
      });

      const providerIssue = ProviderIssueSchema.parse(response.data);

      return {
        iid: providerIssue.iid,
        title: providerIssue.title,
        ...(providerIssue.description != null && { description: providerIssue.description }),
        state: providerIssue.state,
        labels: providerIssue.labels,
        assignees: providerIssue.assignees,
        ...(providerIssue.milestone != null && { milestone: providerIssue.milestone }),
        ...(providerIssue.due_date != null && { due_date: providerIssue.due_date }),
        ...(providerIssue.confidential != null && { confidential: providerIssue.confidential }),
        ...(providerIssue.discussion_locked != null && { discussion_locked: providerIssue.discussion_locked }),
        ...(providerIssue.issue_type != null && { issue_type: providerIssue.issue_type }),
        created_at: providerIssue.created_at,
        updated_at: providerIssue.updated_at,
        web_url: providerIssue.web_url,
        project_id: providerIssue.project_id,
      };
    },
  });
}
