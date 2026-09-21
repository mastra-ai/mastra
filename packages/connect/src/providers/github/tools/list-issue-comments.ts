// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listIssueCommentsInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "octocat"'),
  repo: z.string().describe('The name of the repository. Example: "hello-world"'),
  issue_number: z.number().int().describe('The number that identifies the issue. Example: 1'),
  per_page: z.number().int().optional().describe('The number of results per page (max 100). Example: 30'),
  page: z.number().int().optional().describe('Page number of the results to fetch. Example: 1'),
});

const ProviderCommentSchema = z.object({
  id: z.number().int(),
  node_id: z.string().optional(),
  url: z.string().optional(),
  html_url: z.string().optional(),
  body: z.string().nullable().optional(),
  user: z
    .object({
      login: z.string().optional(),
      id: z.number().int().optional(),
      node_id: z.string().optional(),
      avatar_url: z.string().optional(),
      html_url: z.string().optional(),
    })
    .optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  issue_url: z.string().optional(),
});

const OutputCommentSchema = z.object({
  id: z.number().int().describe('The unique identifier of the comment. Example: 1'),
  node_id: z.string().optional().describe('The node ID of the comment. Example: "MDEyOklzc3VlQ29tbWVudDE="'),
  url: z
    .string()
    .optional()
    .describe(
      'The REST API URL for the issue comment. Example: "https://api.github.com/repos/octocat/hello-world/issues/comments/1"',
    ),
  html_url: z
    .string()
    .optional()
    .describe(
      'The HTML URL for the issue comment. Example: "https://github.com/octocat/hello-world/issues/1#issuecomment-1"',
    ),
  body: z.string().optional().describe('The contents of the issue comment.'),
  user_login: z.string().optional().describe('The login username of the comment author. Example: "octocat"'),
  user_id: z.number().int().optional().describe('The unique identifier of the comment author. Example: 1'),
  created_at: z
    .string()
    .optional()
    .describe('The time the comment was created in ISO 8601 format. Example: "2011-04-14T16:00:49Z"'),
  updated_at: z
    .string()
    .optional()
    .describe('The time the comment was last updated in ISO 8601 format. Example: "2011-04-14T16:00:49Z"'),
  issue_url: z
    .string()
    .optional()
    .describe('The REST API URL for the issue. Example: "https://api.github.com/repos/octocat/hello-world/issues/1"'),
});

export const listIssueCommentsOutputSchema = z.object({
  comments: z.array(OutputCommentSchema).describe('Array of issue comments'),
  next_page: z.number().int().optional().describe('The next page number if more results are available'),
});

export function listIssueCommentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_list_issue_comments',
    description: 'List comments attached to an issue or pull request thread',
    inputSchema: listIssueCommentsInputSchema,
    outputSchema: listIssueCommentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listIssueCommentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};

      if (input['per_page'] !== undefined) {
        params['per_page'] = input['per_page'];
      }
      if (input['page'] !== undefined) {
        params['page'] = input['page'];
      }

      // https://docs.github.com/en/rest/issues/comments?apiVersion=2022-11-28#list-issue-comments
      const response = await platformProxy.get({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/issues/${input.issue_number}/comments`,
        params,
        retries: 3,
      });

      const comments = z.array(ProviderCommentSchema).parse(response.data);

      const mappedComments = comments.map(comment => ({
        id: comment.id,
        ...(comment.node_id !== undefined && { node_id: comment.node_id }),
        ...(comment.url !== undefined && { url: comment.url }),
        ...(comment.html_url !== undefined && { html_url: comment.html_url }),
        ...(comment.body != null && { body: comment.body }),
        ...(comment.user?.login !== undefined && { user_login: comment.user.login }),
        ...(comment.user?.id !== undefined && { user_id: comment.user.id }),
        ...(comment.created_at !== undefined && { created_at: comment.created_at }),
        ...(comment.updated_at !== undefined && { updated_at: comment.updated_at }),
        ...(comment.issue_url !== undefined && { issue_url: comment.issue_url }),
      }));

      const rawLink = response.headers?.['link'];
      const linkHeader = typeof rawLink === 'string' ? rawLink : undefined;
      const hasNextPage = linkHeader ? linkHeader.includes('rel="next"') : false;
      const currentPage = input['page'] ?? 1;
      const next_page = hasNextPage ? currentPage + 1 : undefined;

      return {
        comments: mappedComments,
        ...(next_page !== undefined && { next_page }),
      };
    },
  });
}
