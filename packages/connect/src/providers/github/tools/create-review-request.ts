// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createReviewRequestInputSchema = z
  .object({
    owner: z.string().describe('Repository owner (username or organization). Example: "octocat"'),
    repo: z.string().describe('Repository name. Example: "hello-world"'),
    pull_number: z.number().int().positive().describe('Pull request number. Example: 1'),
    reviewers: z
      .array(z.string())
      .optional()
      .describe('Usernames of users to request reviews from. Example: ["octocat"]'),
    team_reviewers: z
      .array(z.string())
      .optional()
      .describe('Slugs of teams to request reviews from. Example: ["justice-league"]'),
  })
  .refine(
    data => (data.reviewers && data.reviewers.length > 0) || (data.team_reviewers && data.team_reviewers.length > 0),
    {
      message: 'At least one reviewer or team_reviewer must be specified',
    },
  );

const SimpleUserSchema = z.object({
  login: z.string(),
  id: z.number(),
  node_id: z.string().optional(),
  avatar_url: z.string().optional(),
  gravatar_id: z.string().optional(),
  url: z.string().optional(),
  html_url: z.string().optional(),
  type: z.string().optional(),
});

const TeamSchema = z.object({
  id: z.number(),
  node_id: z.string().optional(),
  url: z.string().optional(),
  html_url: z.string().optional(),
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  privacy: z.string().optional(),
  permission: z.string().optional(),
  members_url: z.string().optional(),
  repositories_url: z.string().optional(),
  parent: z.unknown().optional(),
});

export const createReviewRequestOutputSchema = z.object({
  id: z.number().describe('Pull request ID'),
  number: z.number().describe('Pull request number'),
  state: z.string().describe('Pull request state'),
  title: z.string().describe('Pull request title'),
  requested_reviewers: z.array(SimpleUserSchema).optional().describe('Users requested to review'),
  requested_teams: z.array(TeamSchema).optional().describe('Teams requested to review'),
});

export function createReviewRequestTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_create_review_request',
    description: 'Request reviewers or teams on an open pull request',
    inputSchema: createReviewRequestInputSchema,
    outputSchema: createReviewRequestOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createReviewRequestOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: { reviewers?: string[]; team_reviewers?: string[] } = {};

      if (input.reviewers !== undefined && input.reviewers.length > 0) {
        requestBody.reviewers = input.reviewers;
      }

      if (input.team_reviewers !== undefined && input.team_reviewers.length > 0) {
        requestBody.team_reviewers = input.team_reviewers;
      }

      // https://docs.github.com/en/rest/pulls/review-requests?apiVersion=2022-11-28#request-reviewers-for-a-pull-request
      const response = await platformProxy.post({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/pulls/${input.pull_number}/requested_reviewers`,
        data: requestBody,
        retries: 3,
      });

      const providerData = z
        .object({
          id: z.number(),
          number: z.number(),
          state: z.string(),
          title: z.string(),
          requested_reviewers: z.array(SimpleUserSchema).optional(),
          requested_teams: z.array(TeamSchema).optional(),
        })
        .parse(response.data);

      return {
        id: providerData.id,
        number: providerData.number,
        state: providerData.state,
        title: providerData.title,
        ...(providerData.requested_reviewers !== undefined &&
          providerData.requested_reviewers.length > 0 && {
            requested_reviewers: providerData.requested_reviewers,
          }),
        ...(providerData.requested_teams !== undefined &&
          providerData.requested_teams.length > 0 && {
            requested_teams: providerData.requested_teams,
          }),
      };
    },
  });
}
