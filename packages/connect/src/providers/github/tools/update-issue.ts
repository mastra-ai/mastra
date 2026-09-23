// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateIssueInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "octocat"'),
  repo: z.string().describe('The name of the repository. Example: "hello-world"'),
  issue_number: z.number().describe('The number that identifies the issue. Example: 1'),
  title: z.string().optional().describe('The title of the issue.'),
  body: z.string().nullable().optional().describe('The contents of the issue.'),
  state: z.enum(['open', 'closed']).optional().describe('State of the issue.'),
  state_reason: z
    .enum(['completed', 'not_planned', 'reopened', 'duplicate'])
    .nullable()
    .optional()
    .describe('The reason for the state change.'),
  labels: z.array(z.string()).optional().describe('Labels to associate with this issue. Example: ["bug", "ui"]'),
  assignees: z.array(z.string()).optional().describe('Logins for Users to assign to this issue. Example: ["octocat"]'),
  milestone: z.number().nullable().optional().describe('The number of the milestone to associate this issue with.'),
});

const UserSchema = z.object({
  login: z.string(),
  id: z.number(),
  avatar_url: z.string(),
  html_url: z.string(),
});

const LabelSchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string(),
  description: z.string().optional(),
});

const MilestoneSchema = z.object({
  url: z.string(),
  html_url: z.string(),
  labels_url: z.string(),
  id: z.number(),
  node_id: z.string(),
  number: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  state: z.enum(['open', 'closed']).or(z.string()),
  open_issues: z.number(),
  closed_issues: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  due_on: z.string().nullable(),
  closed_at: z.string().nullable(),
});

const ProviderIssueSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  url: z.string(),
  repository_url: z.string(),
  labels_url: z.string(),
  comments_url: z.string(),
  events_url: z.string(),
  html_url: z.string(),
  number: z.number(),
  state: z.string(),
  state_reason: z.string().nullable(),
  title: z.string(),
  body: z.string().nullable(),
  user: UserSchema.nullable(),
  labels: z.array(LabelSchema),
  assignees: z.array(UserSchema),
  milestone: MilestoneSchema.nullable(),
  locked: z.boolean(),
  active_lock_reason: z.string().nullable(),
  comments: z.number(),
  closed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const updateIssueOutputSchema = z.object({
  id: z.number().describe('The ID of the issue.'),
  node_id: z.string().describe('The node ID of the issue.'),
  number: z.number().describe('The number of the issue.'),
  title: z.string().describe('The title of the issue.'),
  state: z.string().describe('The state of the issue.'),
  state_reason: z.string().optional().describe('The reason for the state change.'),
  body: z.string().optional().describe('The contents of the issue.'),
  html_url: z.string().describe('The URL of the issue.'),
  url: z.string().describe('The API URL of the issue.'),
  repository_url: z.string().describe('The repository API URL.'),
  labels: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        color: z.string(),
        description: z.string().optional(),
      }),
    )
    .describe('The labels associated with the issue.'),
  assignees: z
    .array(
      z.object({
        login: z.string(),
        id: z.number(),
        avatar_url: z.string(),
        html_url: z.string(),
      }),
    )
    .describe('The users assigned to the issue.'),
  milestone: z
    .object({
      url: z.string(),
      html_url: z.string(),
      id: z.number(),
      number: z.number(),
      title: z.string(),
      description: z.string().optional(),
      state: z.string(),
    })
    .optional()
    .describe('The milestone associated with the issue.'),
  locked: z.boolean().describe('Whether the issue is locked.'),
  comments: z.number().describe('The number of comments.'),
  created_at: z.string().describe('The creation timestamp.'),
  updated_at: z.string().describe('The last update timestamp.'),
  closed_at: z.string().optional().describe('The closure timestamp.'),
});

export function updateIssueTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_update_issue',
    description: "Edit an issue's title, body, state, assignees, labels, or milestone.",
    inputSchema: updateIssueInputSchema,
    outputSchema: updateIssueOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateIssueOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const { owner, repo, issue_number, ...updateFields } = input;

      // Build the request body with only defined fields
      const requestBody: Record<string, unknown> = {};
      if (updateFields.title !== undefined) {
        requestBody['title'] = updateFields.title;
      }
      if (updateFields.body !== undefined) {
        requestBody['body'] = updateFields.body;
      }
      if (updateFields.state !== undefined) {
        requestBody['state'] = updateFields.state;
      }
      if (updateFields.state_reason !== undefined) {
        requestBody['state_reason'] = updateFields.state_reason;
      }
      if (updateFields.labels !== undefined) {
        requestBody['labels'] = updateFields.labels;
      }
      if (updateFields.assignees !== undefined) {
        requestBody['assignees'] = updateFields.assignees;
      }
      if (updateFields.milestone !== undefined) {
        requestBody['milestone'] = updateFields.milestone;
      }

      // https://docs.github.com/en/rest/issues/issues#update-an-issue
      const response = await platformProxy.patch({
        endpoint: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issue_number}`,
        data: requestBody,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Issue not found or update failed',
          owner,
          repo,
          issue_number,
        });
      }

      const providerIssue = ProviderIssueSchema.parse(response.data);

      return {
        id: providerIssue.id,
        node_id: providerIssue.node_id,
        number: providerIssue.number,
        title: providerIssue.title,
        state: providerIssue.state,
        state_reason: providerIssue.state_reason ?? undefined,
        body: providerIssue.body ?? undefined,
        html_url: providerIssue.html_url,
        url: providerIssue.url,
        repository_url: providerIssue.repository_url,
        labels: providerIssue.labels.map(label => ({
          id: label.id,
          name: label.name,
          color: label.color,
          description: label.description,
        })),
        assignees: providerIssue.assignees.map(assignee => ({
          login: assignee.login,
          id: assignee.id,
          avatar_url: assignee.avatar_url,
          html_url: assignee.html_url,
        })),
        milestone: providerIssue.milestone
          ? {
              url: providerIssue.milestone.url,
              html_url: providerIssue.milestone.html_url,
              id: providerIssue.milestone.id,
              number: providerIssue.milestone.number,
              title: providerIssue.milestone.title,
              description: providerIssue.milestone.description ?? undefined,
              state: providerIssue.milestone.state,
            }
          : undefined,
        locked: providerIssue.locked,
        comments: providerIssue.comments,
        created_at: providerIssue.created_at,
        updated_at: providerIssue.updated_at,
        closed_at: providerIssue.closed_at ?? undefined,
      };
    },
  });
}
