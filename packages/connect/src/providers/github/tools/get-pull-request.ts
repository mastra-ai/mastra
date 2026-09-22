// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getPullRequestInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "octocat"'),
  repo: z.string().describe('The name of the repository. Example: "Hello-World"'),
  pull_number: z.number().int().positive().describe('The number that identifies the pull request. Example: 1'),
});

const HeadSchema = z.object({
  ref: z.string(),
  sha: z.string(),
});

const BaseSchema = z.object({
  ref: z.string(),
  sha: z.string(),
});

const UserSchema = z.object({
  login: z.string(),
  id: z.number(),
});

const ProviderPullRequestSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  state: z.string(),
  body: z.string().nullable(),
  head: HeadSchema,
  base: BaseSchema,
  user: UserSchema,
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  merged_at: z.string().nullable(),
});

export const getPullRequestOutputSchema = z.object({
  id: z.number().describe('The unique identifier of the pull request. Example: 1'),
  number: z.number().describe('The number of the pull request in the repository. Example: 1347'),
  title: z.string().describe('The title of the pull request.'),
  state: z.string().describe('The state of the pull request. Example: "open"'),
  body: z.string().nullable().describe('The body content of the pull request.'),
  head: z.object({
    ref: z.string().describe('The branch name of the head. Example: "new-topic"'),
    sha: z.string().describe('The commit SHA of the head.'),
  }),
  base: z.object({
    ref: z.string().describe('The branch name of the base. Example: "main"'),
    sha: z.string().describe('The commit SHA of the base.'),
  }),
  user: z.object({
    login: z.string().describe('The username of the author.'),
    id: z.number().describe('The user ID of the author.'),
  }),
  created_at: z.string().describe('The timestamp when the pull request was created.'),
  updated_at: z.string().describe('The timestamp when the pull request was last updated.'),
  closed_at: z.string().nullable().describe('The timestamp when the pull request was closed.'),
  merged_at: z.string().nullable().describe('The timestamp when the pull request was merged.'),
});

export function getPullRequestTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_get_pull_request',
    description: 'Fetch a single pull request by number.',
    inputSchema: getPullRequestInputSchema,
    outputSchema: getPullRequestOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getPullRequestOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request
      const response = await platformProxy.get({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/pulls/${input.pull_number}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Pull request #${input.pull_number} not found in ${input.owner}/${input.repo}`,
          owner: input.owner,
          repo: input.repo,
          pull_number: input.pull_number,
        });
      }

      const providerPR = ProviderPullRequestSchema.parse(response.data);

      return {
        id: providerPR.id,
        number: providerPR.number,
        title: providerPR.title,
        state: providerPR.state,
        body: providerPR.body,
        head: {
          ref: providerPR.head.ref,
          sha: providerPR.head.sha,
        },
        base: {
          ref: providerPR.base.ref,
          sha: providerPR.base.sha,
        },
        user: {
          login: providerPR.user.login,
          id: providerPR.user.id,
        },
        created_at: providerPR.created_at,
        updated_at: providerPR.updated_at,
        closed_at: providerPR.closed_at,
        merged_at: providerPR.merged_at,
      };
    },
  });
}
