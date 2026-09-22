// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const addIssueCommentInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "octocat"'),
  repo: z.string().describe('The name of the repository. Example: "hello-world"'),
  issue_number: z.number().describe('The number that identifies the issue. Example: 42'),
  body: z.string().describe('The contents of the comment. Markdown is supported. Example: "This is a comment"'),
});

const ProviderCommentSchema = z
  .object({
    id: z.number(),
    node_id: z.string(),
    url: z.string(),
    body: z.string().nullable(),
    body_text: z.string().nullable().optional(),
    body_html: z.string().nullable().optional(),
    html_url: z.string(),
    user: z
      .object({
        login: z.string(),
        id: z.number(),
        node_id: z.string(),
        avatar_url: z.string(),
        gravatar_id: z.string().nullable(),
        url: z.string(),
        html_url: z.string(),
        followers_url: z.string(),
        following_url: z.string(),
        gists_url: z.string(),
        starred_url: z.string(),
        subscriptions_url: z.string(),
        organizations_url: z.string(),
        repos_url: z.string(),
        events_url: z.string(),
        received_events_url: z.string(),
        type: z.string(),
        site_admin: z.boolean(),
      })
      .nullable(),
  })
  .passthrough();

export const addIssueCommentOutputSchema = z.object({
  id: z.number().describe('The unique identifier of the comment'),
  node_id: z.string().describe('The node ID of the comment'),
  url: z.string().describe('The API URL of the comment'),
  body: z.string().optional().describe('The contents of the comment'),
  html_url: z.string().describe('The HTML URL of the comment'),
  user: z
    .object({
      login: z.string(),
      id: z.number(),
      avatar_url: z.string(),
      html_url: z.string(),
    })
    .optional()
    .describe('The user who created the comment'),
  created_at: z.string().optional().describe('The timestamp when the comment was created'),
  updated_at: z.string().optional().describe('The timestamp when the comment was last updated'),
  issue_url: z.string().optional().describe('The API URL of the issue'),
});

export function addIssueCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_add_issue_comment',
    description: 'Create a new comment on an issue or pull request discussion thread',
    inputSchema: addIssueCommentInputSchema,
    outputSchema: addIssueCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof addIssueCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.github.com/en/rest/issues/comments#create-an-issue-comment
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/issues/${input.issue_number}/comments`,
        data: {
          body: input.body,
        },
        retries: 10,
      });

      const providerComment = ProviderCommentSchema.parse(response.data);

      const user = providerComment.user;
      const simplifiedUser = user
        ? {
            login: user.login,
            id: user.id,
            avatar_url: user.avatar_url,
            html_url: user.html_url,
          }
        : undefined;

      const result: z.infer<typeof addIssueCommentOutputSchema> = {
        id: providerComment.id,
        node_id: providerComment.node_id,
        url: providerComment.url,
        html_url: providerComment.html_url,
        ...(providerComment.body != null && { body: providerComment.body }),
        ...(simplifiedUser && { user: simplifiedUser }),
      };

      if (response.data && typeof response.data === 'object') {
        const data = response.data;
        if ('created_at' in data && data['created_at'] != null) {
          result['created_at'] = String(data['created_at']);
        }
        if ('updated_at' in data && data['updated_at'] != null) {
          result['updated_at'] = String(data['updated_at']);
        }
        if ('issue_url' in data && data['issue_url'] != null) {
          result['issue_url'] = String(data['issue_url']);
        }
      }

      return result;
    },
  });
}
