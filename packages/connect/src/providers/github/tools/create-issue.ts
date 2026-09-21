// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createIssueInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "octocat"'),
  repo: z.string().describe('The name of the repository. Example: "Hello-World"'),
  title: z.string().describe('The title of the issue. Example: "Found a bug"'),
  body: z.string().optional().describe('The contents of the issue. Example: "I am having a problem with this."'),
  assignees: z.array(z.string()).optional().describe('Logins for Users to assign to this issue. Example: ["octocat"]'),
  labels: z.array(z.string()).optional().describe('Labels to associate with this issue. Example: ["bug", "ui"]'),
  milestone: z
    .union([z.number(), z.string()])
    .optional()
    .describe('The number of the milestone to associate this issue with. Example: 1'),
});

const ProviderLabelSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  url: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string(),
  default: z.boolean(),
});

const ProviderUserSchema = z.object({
  login: z.string(),
  id: z.number(),
  node_id: z.string(),
  avatar_url: z.string(),
  gravatar_id: z.string().nullable(),
  url: z.string(),
  html_url: z.string(),
  type: z.string(),
  site_admin: z.boolean(),
});

const ProviderMilestoneSchema = z.object({
  url: z.string(),
  html_url: z.string(),
  labels_url: z.string(),
  id: z.number(),
  node_id: z.string(),
  number: z.number(),
  state: z.string(),
  title: z.string(),
  description: z.string().nullable(),
});

const ProviderIssueSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  url: z.string(),
  repository_url: z.string(),
  html_url: z.string(),
  number: z.number(),
  state: z.string(),
  state_reason: z.string().nullable(),
  title: z.string(),
  body: z.string().nullable(),
  user: ProviderUserSchema.nullable(),
  labels: z.array(ProviderLabelSchema),
  assignees: z.array(ProviderUserSchema),
  milestone: ProviderMilestoneSchema.nullable(),
  locked: z.boolean(),
  comments: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  author_association: z.string(),
});

export const createIssueOutputSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  url: z.string(),
  html_url: z.string(),
  number: z.number(),
  state: z.string(),
  state_reason: z.string().optional(),
  title: z.string(),
  body: z.string().optional(),
  user_login: z.string().optional(),
  labels: z.array(z.string()),
  assignees: z.array(z.string()),
  milestone_number: z.number().optional(),
  locked: z.boolean(),
  comments: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().optional(),
});

export function createIssueTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_create_issue',
    description: 'Open a new GitHub issue in a repository.',
    inputSchema: createIssueInputSchema,
    outputSchema: createIssueOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createIssueOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/issues/issues#create-an-issue
      const response = await platformProxy.post({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/issues`,
        data: {
          title: input.title,
          ...(input.body !== undefined && { body: input.body }),
          ...(input.assignees !== undefined && { assignees: input.assignees }),
          ...(input.labels !== undefined && { labels: input.labels }),
          ...(input.milestone !== undefined && { milestone: input.milestone }),
        },
        retries: 10,
      });

      const providerIssue = ProviderIssueSchema.parse(response.data);

      return {
        id: providerIssue.id,
        node_id: providerIssue.node_id,
        url: providerIssue.url,
        html_url: providerIssue.html_url,
        number: providerIssue.number,
        state: providerIssue.state,
        ...(providerIssue.state_reason !== null && { state_reason: providerIssue.state_reason }),
        title: providerIssue.title,
        ...(providerIssue.body !== null && { body: providerIssue.body }),
        ...(providerIssue.user !== null && { user_login: providerIssue.user.login }),
        labels: providerIssue.labels.map(label => label.name),
        assignees: providerIssue.assignees.map(assignee => assignee.login),
        ...(providerIssue.milestone !== null && { milestone_number: providerIssue.milestone.number }),
        locked: providerIssue.locked,
        comments: providerIssue.comments,
        created_at: providerIssue.created_at,
        updated_at: providerIssue.updated_at,
        ...(providerIssue.closed_at !== null && { closed_at: providerIssue.closed_at }),
      };
    },
  });
}
