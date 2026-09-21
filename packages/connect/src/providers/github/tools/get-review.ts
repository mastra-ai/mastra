// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getReviewInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "octocat"'),
  repo: z.string().describe('The name of the repository. Example: "Hello-World"'),
  pull_number: z.number().describe('The number of the pull request. Example: 1'),
  review_id: z.number().describe('The unique identifier of the review. Example: 1'),
});

const ProviderReviewSchema = z
  .object({
    id: z.number(),
    user: z
      .object({
        login: z.string(),
        id: z.number(),
        avatar_url: z.string().optional(),
        html_url: z.string().optional(),
      })
      .passthrough(),
    body: z.string().nullable(),
    state: z.string(),
    html_url: z.string(),
    pull_request_url: z.string(),
    commit_id: z.string(),
    submitted_at: z.string().optional(),
  })
  .passthrough();

export const getReviewOutputSchema = z.object({
  id: z.number(),
  user_login: z.string(),
  user_id: z.number(),
  body: z.string().optional(),
  state: z.string(),
  html_url: z.string(),
  pull_request_url: z.string(),
  commit_id: z.string(),
  submitted_at: z.string().optional(),
});

export function getReviewTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_get_review',
    description: 'Retrieve a pull request review by review ID.',
    inputSchema: getReviewInputSchema,
    outputSchema: getReviewOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getReviewOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const encodedOwner = encodeURIComponent(input.owner);
      const encodedRepo = encodeURIComponent(input.repo);

      // https://docs.github.com/en/rest/pulls/reviews#get-a-review-for-a-pull-request
      const response = await platformProxy.get({
        endpoint: `/repos/${encodedOwner}/${encodedRepo}/pulls/${input.pull_number}/reviews/${input.review_id}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Review not found',
          review_id: input.review_id,
          pull_number: input.pull_number,
          owner: input.owner,
          repo: input.repo,
        });
      }

      const providerReview = ProviderReviewSchema.parse(response.data);

      return {
        id: providerReview.id,
        user_login: providerReview.user.login,
        user_id: providerReview.user.id,
        ...(providerReview.body != null && { body: providerReview.body }),
        state: providerReview.state,
        html_url: providerReview.html_url,
        pull_request_url: providerReview.pull_request_url,
        commit_id: providerReview.commit_id,
        ...(providerReview.submitted_at != null && { submitted_at: providerReview.submitted_at }),
      };
    },
  });
}
