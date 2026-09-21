// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createReleaseInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "octocat"'),
  repo: z.string().describe('The name of the repository. Example: "Hello-World"'),
  tag_name: z.string().describe('The name of the tag. Example: "v1.0.0"'),
  target_commitish: z
    .string()
    .optional()
    .describe(
      'The commitish value that determines where the Git tag is created from. Can be any branch or commit SHA. Defaults to the repository\'s default branch. Example: "main"',
    ),
  name: z.string().optional().describe('The name of the release. Example: "v1.0.0 - First Release"'),
  body: z
    .string()
    .optional()
    .describe('Text describing the contents of the tag. Example: "Description of the release"'),
  draft: z.boolean().optional().describe('Whether the release is a draft. Defaults to false.'),
  prerelease: z.boolean().optional().describe('Whether the release is a prerelease. Defaults to false.'),
});

const ProviderReleaseSchema = z.object({
  id: z.number(),
  tag_name: z.string(),
  target_commitish: z.string().optional(),
  name: z.string().nullish(),
  body: z.string().nullish(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  created_at: z.string(),
  published_at: z.string().nullish(),
  html_url: z.string(),
  assets_url: z.string().optional(),
  upload_url: z.string().optional(),
  tarball_url: z.string().nullish(),
  zipball_url: z.string().nullish(),
  node_id: z.string().optional(),
});

export const createReleaseOutputSchema = z.object({
  id: z.number(),
  tag_name: z.string(),
  target_commitish: z.string().optional(),
  name: z.string().optional(),
  body: z.string().optional(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  created_at: z.string(),
  published_at: z.string().optional(),
  html_url: z.string(),
});

export function createReleaseTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_create_release',
    description: 'Publish a Git tag release for a repository.',
    inputSchema: createReleaseInputSchema,
    outputSchema: createReleaseOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createReleaseOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.github.com/en/rest/releases/releases#create-a-release
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/releases`,
        data: {
          tag_name: input.tag_name,
          ...(input.target_commitish !== undefined && { target_commitish: input.target_commitish }),
          ...(input.name !== undefined && { name: input.name }),
          ...(input.body !== undefined && { body: input.body }),
          ...(input.draft !== undefined && { draft: input.draft }),
          ...(input.prerelease !== undefined && { prerelease: input.prerelease }),
        },
        retries: 3,
      });

      const release = ProviderReleaseSchema.parse(response.data);

      return {
        id: release.id,
        tag_name: release.tag_name,
        ...(release.target_commitish !== undefined && { target_commitish: release.target_commitish }),
        ...(release.name != null && { name: release.name }),
        ...(release.body != null && { body: release.body }),
        draft: release.draft,
        prerelease: release.prerelease,
        created_at: release.created_at,
        ...(release.published_at != null && { published_at: release.published_at }),
        html_url: release.html_url,
      };
    },
  });
}
