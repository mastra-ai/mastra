// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getIssueInputSchema = z.object({
  owner: z.string().describe('Repository owner. Example: "octocat"'),
  repo: z.string().describe('Repository name. Example: "hello-world"'),
  issue_number: z.number().describe('Issue number. Example: 1'),
});

const ProviderIssueSchema = z
  .object({
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
    title: z.string(),
    body: z.string().nullable(),
    user: z
      .object({
        login: z.string(),
        id: z.number(),
        node_id: z.string(),
        avatar_url: z.string(),
        gravatar_id: z.string(),
        url: z.string(),
        html_url: z.string(),
        type: z.string(),
      })
      .passthrough(),
    labels: z.array(
      z
        .object({
          id: z.number(),
          node_id: z.string(),
          url: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          color: z.string(),
          default: z.boolean(),
        })
        .passthrough(),
    ),
    assignee: z
      .object({
        login: z.string(),
        id: z.number(),
        avatar_url: z.string().optional(),
        html_url: z.string().optional(),
      })
      .nullable(),
    assignees: z.array(z.unknown()),
    milestone: z
      .object({
        id: z.number(),
        number: z.number(),
        title: z.string(),
        state: z.string(),
      })
      .nullable(),
    locked: z.boolean(),
    active_lock_reason: z.string().nullable(),
    comments: z.number(),
    pull_request: z
      .object({
        url: z.string(),
        html_url: z.string(),
        diff_url: z.string(),
        patch_url: z.string(),
      })
      .optional(),
    closed_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    closed_by: z.unknown().optional(),
  })
  .passthrough();

export const getIssueOutputSchema = z.object({
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
  title: z.string(),
  body: z.string().optional(),
  user: z
    .object({
      login: z.string(),
      id: z.number(),
      node_id: z.string(),
      avatar_url: z.string(),
      gravatar_id: z.string(),
      url: z.string(),
      html_url: z.string(),
      type: z.string(),
    })
    .passthrough(),
  labels: z.array(
    z
      .object({
        id: z.number(),
        node_id: z.string(),
        url: z.string(),
        name: z.string(),
        description: z.string().optional(),
        color: z.string(),
        default: z.boolean(),
      })
      .passthrough(),
  ),
  assignee: z
    .object({
      login: z.string(),
      id: z.number(),
      avatar_url: z.string().optional(),
      html_url: z.string().optional(),
    })
    .nullable(),
  assignees: z.array(z.unknown()),
  milestone: z
    .object({
      id: z.number(),
      number: z.number(),
      title: z.string(),
      state: z.string(),
    })
    .nullable(),
  locked: z.boolean(),
  active_lock_reason: z.string().optional(),
  comments: z.number(),
  pull_request: z
    .object({
      url: z.string(),
      html_url: z.string(),
      diff_url: z.string(),
      patch_url: z.string(),
    })
    .optional(),
  closed_at: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_by: z.unknown().optional(),
});

export function getIssueTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_get_issue',
    description: 'Fetch a single issue or pull request issue record by number.',
    inputSchema: getIssueInputSchema,
    outputSchema: getIssueOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getIssueOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/issues/issues#get-an-issue
      const response = await platformProxy.get({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/issues/${input.issue_number}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Issue not found',
          owner: input.owner,
          repo: input.repo,
          issue_number: input.issue_number,
        });
      }

      const providerIssue = ProviderIssueSchema.parse(response.data);

      return {
        id: providerIssue.id,
        node_id: providerIssue.node_id,
        url: providerIssue.url,
        repository_url: providerIssue.repository_url,
        labels_url: providerIssue.labels_url,
        comments_url: providerIssue.comments_url,
        events_url: providerIssue.events_url,
        html_url: providerIssue.html_url,
        number: providerIssue.number,
        state: providerIssue.state,
        title: providerIssue.title,
        ...(providerIssue.body !== null && { body: providerIssue.body }),
        user: providerIssue.user,
        labels: providerIssue.labels.map(label => ({
          id: label.id,
          node_id: label.node_id,
          url: label.url,
          name: label.name,
          ...(label.description !== null && { description: label.description }),
          color: label.color,
          default: label.default,
        })),
        assignee: providerIssue.assignee,
        assignees: providerIssue.assignees,
        milestone: providerIssue.milestone,
        locked: providerIssue.locked,
        ...(providerIssue.active_lock_reason !== null && { active_lock_reason: providerIssue.active_lock_reason }),
        comments: providerIssue.comments,
        ...(providerIssue.pull_request !== undefined && { pull_request: providerIssue.pull_request }),
        ...(providerIssue.closed_at !== null && { closed_at: providerIssue.closed_at }),
        created_at: providerIssue.created_at,
        updated_at: providerIssue.updated_at,
        ...(providerIssue.closed_by !== undefined && { closed_by: providerIssue.closed_by }),
      };
    },
  });
}
