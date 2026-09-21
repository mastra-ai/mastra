// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const InlineCommentSchema = z
  .object({
    path: z.string().describe('The relative path to the file that necessitates a review comment.'),
    position: z.number().optional().describe('The position in the diff where you want to add a review comment.'),
    body: z.string().describe('Text of the review comment.'),
    line: z.number().optional().describe('The line of the blob in the pull request diff.'),
    side: z.enum(['LEFT', 'RIGHT']).optional().describe('The side of the diff.'),
    start_line: z.number().optional().describe('The start line of the range for a multi-line comment.'),
    start_side: z.enum(['LEFT', 'RIGHT']).optional().describe('The start side of the diff for a multi-line comment.'),
  })
  .refine(data => data.position !== undefined || data.line !== undefined, {
    message: "Inline comment must specify either 'position' or 'line' to locate it in the diff.",
  });

export const submitPullRequestReviewInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "octocat"'),
  repo: z.string().describe('The name of the repository. Example: "hello-world"'),
  pull_number: z.number().describe('The number that identifies the pull request. Example: 42'),
  event: z.enum(['APPROVE', 'REQUEST_CHANGES', 'COMMENT']).describe('The review action to perform.'),
  body: z
    .string()
    .optional()
    .describe('The body text of the pull request review. Required for REQUEST_CHANGES or COMMENT.'),
  commit_id: z
    .string()
    .optional()
    .describe('The SHA of the commit that needs a review. Defaults to the most recent commit.'),
  comments: z.array(InlineCommentSchema).optional().describe('Draft review comments to include in the review.'),
});

const SimpleUserSchema = z.object({
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

const ProviderReviewSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  user: z.union([z.null(), SimpleUserSchema]),
  body: z.string(),
  state: z.string(),
  html_url: z.string(),
  pull_request_url: z.string(),
  submitted_at: z.string().optional(),
  commit_id: z.string().nullable(),
  author_association: z.string(),
});

export const submitPullRequestReviewOutputSchema = z.object({
  id: z.number(),
  nodeId: z.string(),
  user: z
    .object({
      login: z.string().optional(),
      id: z.number().optional(),
      htmlUrl: z.string().optional(),
    })
    .optional(),
  body: z.string(),
  state: z.string(),
  htmlUrl: z.string(),
  pullRequestUrl: z.string(),
  submittedAt: z.string().optional(),
  commitId: z.string().optional(),
  authorAssociation: z.string(),
});

export function submitPullRequestReviewTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_submit_pull_request_review',
    description: 'Create a pull request review with approval, comment, or change request.',
    inputSchema: submitPullRequestReviewInputSchema,
    outputSchema: submitPullRequestReviewOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof submitPullRequestReviewOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if ((input.event === 'REQUEST_CHANGES' || input.event === 'COMMENT') && !input.body) {
        throw new platformProxy.ActionError({
          type: 'missing_body',
          message: 'The body field is required when event is REQUEST_CHANGES or COMMENT.',
        });
      }

      const comments =
        input.comments !== undefined && input.comments.length > 0
          ? input.comments.map(comment => ({
              path: comment.path,
              ...(comment.position !== undefined && { position: comment.position }),
              body: comment.body,
              ...(comment.line !== undefined && { line: comment.line }),
              ...(comment.side !== undefined && { side: comment.side }),
              ...(comment.start_line !== undefined && { start_line: comment.start_line }),
              ...(comment.start_side !== undefined && { start_side: comment.start_side }),
            }))
          : undefined;

      const requestBody = {
        event: input.event,
        ...(input.body !== undefined && { body: input.body }),
        ...(input.commit_id !== undefined && { commit_id: input.commit_id }),
        ...(comments !== undefined && { comments }),
      };

      // https://docs.github.com/en/rest/pulls/reviews#create-a-review-for-a-pull-request
      const response = await platformProxy.post({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/pulls/${input.pull_number}/reviews`,
        data: requestBody,
        retries: 10,
      });

      const review = ProviderReviewSchema.parse(response.data);

      return {
        id: review.id,
        nodeId: review.node_id,
        ...(review.user && {
          user: {
            login: review.user.login,
            id: review.user.id,
            htmlUrl: review.user.html_url,
          },
        }),
        body: review.body,
        state: review.state,
        htmlUrl: review.html_url,
        pullRequestUrl: review.pull_request_url,
        ...(review.submitted_at !== undefined && { submittedAt: review.submitted_at }),
        ...(review.commit_id !== null && { commitId: review.commit_id }),
        authorAssociation: review.author_association,
      };
    },
  });
}
