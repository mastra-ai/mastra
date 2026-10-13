// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listPullRequestReviewsInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "octocat"'),
  repo: z.string().describe('The name of the repository. Example: "Hello-World"'),
  pull_number: z.number().int().positive().describe('The number that identifies the pull request. Example: 42'),
  per_page: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe('The number of results per page (max 100). Example: 30'),
  page: z.number().int().positive().optional().describe('Page number of the results to fetch. Example: 1'),
});

const UserSchema = z.object({
  login: z.string(),
  id: z.number(),
  avatar_url: z.string().optional(),
  html_url: z.string().optional(),
});

const ReviewSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  user: UserSchema.nullable().optional(),
  body: z.string().nullable(),
  state: z.string(),
  html_url: z.string(),
  pull_request_url: z.string(),
  commit_id: z.string().nullable(),
  submitted_at: z.string().optional(),
});

export const listPullRequestReviewsOutputSchema = z.object({
  reviews: z.array(ReviewSchema),
  total_count: z.number().optional(),
});

export function listPullRequestReviewsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_list_pull_request_reviews',
    description: 'List reviews submitted on a pull request',
    inputSchema: listPullRequestReviewsInputSchema,
    outputSchema: listPullRequestReviewsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPullRequestReviewsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.github.com/en/rest/pulls/reviews#list-reviews-for-a-pull-request
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/pulls/${input.pull_number}/reviews`,
        params: {
          ...(input.per_page !== undefined && { per_page: input.per_page.toString() }),
          ...(input.page !== undefined && { page: input.page.toString() }),
        },
        retries: 3,
      });

      const reviews = z.array(ReviewSchema).parse(response.data);

      return {
        reviews: reviews,
        total_count: reviews.length,
      };
    },
  });
}
