// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createPullRequestInputSchema = z.object({
  owner: z.string().describe('Repository owner. Example: "viictoo"'),
  repo: z.string().describe('Repository name. Example: "api-playground2"'),
  title: z.string().describe('The title of the pull request. Example: "Fix authentication bug"'),
  head: z.string().describe('The name of the branch where your changes are implemented. Example: "feature-branch"'),
  base: z.string().describe('The name of the branch you want the changes pulled into. Example: "main"'),
  body: z.string().optional().describe('The contents of the pull request.'),
  draft: z.boolean().optional().describe('Whether the pull request should be created as a draft.'),
});

const ProviderPullRequestSchema = z
  .object({
    id: z.number(),
    node_id: z.string(),
    html_url: z.string(),
    number: z.number(),
    state: z.string(),
    title: z.string(),
    body: z.string().nullable().optional(),
    user: z
      .object({
        login: z.string(),
        id: z.number(),
      })
      .passthrough()
      .optional(),
    draft: z.boolean().optional(),
    head: z
      .object({
        ref: z.string(),
        sha: z.string(),
      })
      .passthrough()
      .optional(),
    base: z
      .object({
        ref: z.string(),
        sha: z.string(),
      })
      .passthrough()
      .optional(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

export const createPullRequestOutputSchema = z.object({
  id: z.number(),
  nodeId: z.string(),
  url: z.string(),
  number: z.number(),
  state: z.string(),
  title: z.string(),
  body: z.string().optional(),
  draft: z.boolean().optional(),
  headRef: z.string().optional(),
  headSha: z.string().optional(),
  baseRef: z.string().optional(),
  baseSha: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export function createPullRequestTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_create_pull_request',
    description: 'Open a pull request from one branch into another.',
    inputSchema: createPullRequestInputSchema,
    outputSchema: createPullRequestOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createPullRequestOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request
      const response = await platformProxy.post({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/pulls`,
        data: {
          title: input.title,
          head: input.head,
          base: input.base,
          ...(input.body !== undefined && { body: input.body }),
          ...(input.draft !== undefined && { draft: input.draft }),
        },
        retries: 3,
      });

      const providerPullRequest = ProviderPullRequestSchema.parse(response.data);

      return {
        id: providerPullRequest.id,
        nodeId: providerPullRequest.node_id,
        url: providerPullRequest.html_url,
        number: providerPullRequest.number,
        state: providerPullRequest.state,
        title: providerPullRequest.title,
        ...(providerPullRequest.body != null && { body: providerPullRequest.body }),
        ...(providerPullRequest.draft !== undefined && { draft: providerPullRequest.draft }),
        ...(providerPullRequest.head !== undefined && {
          headRef: providerPullRequest.head.ref,
          headSha: providerPullRequest.head.sha,
        }),
        ...(providerPullRequest.base !== undefined && {
          baseRef: providerPullRequest.base.ref,
          baseSha: providerPullRequest.base.sha,
        }),
        createdAt: providerPullRequest.created_at,
        updatedAt: providerPullRequest.updated_at,
      };
    },
  });
}
