// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getReleaseInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "octocat"'),
  repo: z.string().describe('The name of the repository. Example: "hello-world"'),
  release_id: z.number().describe('The unique identifier of the release. Example: 1'),
});

const ProviderReleaseSchema = z.object({
  id: z.number(),
  node_id: z.string().optional(),
  tag_name: z.string().optional(),
  name: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  draft: z.boolean().optional(),
  prerelease: z.boolean().optional(),
  created_at: z.string().optional(),
  published_at: z.string().nullable().optional(),
  author: z
    .object({
      login: z.string(),
      id: z.number(),
      node_id: z.string().optional(),
      avatar_url: z.string().optional(),
      html_url: z.string().optional(),
    })
    .optional(),
  html_url: z.string().optional(),
  tarball_url: z.string().nullable().optional(),
  zipball_url: z.string().nullable().optional(),
  assets: z
    .array(
      z.object({
        id: z.number(),
        node_id: z.string().optional(),
        name: z.string(),
        content_type: z.string().optional(),
        size: z.number().optional(),
        download_count: z.number().optional(),
        created_at: z.string().optional(),
        updated_at: z.string().optional(),
        browser_download_url: z.string().optional(),
      }),
    )
    .optional(),
});

export const getReleaseOutputSchema = z.object({
  id: z.number().describe('The unique identifier of the release'),
  node_id: z.string().optional().describe('The node ID of the release'),
  tag_name: z.string().optional().describe('The name of the tag'),
  name: z.string().optional().describe('The name of the release'),
  body: z.string().optional().describe('The body of the release notes'),
  draft: z.boolean().optional().describe('Whether the release is a draft'),
  prerelease: z.boolean().optional().describe('Whether the release is a prerelease'),
  created_at: z.string().optional().describe('The date the release was created'),
  published_at: z.string().optional().describe('The date the release was published'),
  author: z
    .object({
      login: z.string(),
      id: z.number(),
      node_id: z.string().optional(),
      avatar_url: z.string().optional(),
      html_url: z.string().optional(),
    })
    .optional(),
  html_url: z.string().optional().describe('The URL of the release in the browser'),
  tarball_url: z.string().optional().describe('The URL to download the release as a tarball'),
  zipball_url: z.string().optional().describe('The URL to download the release as a zipball'),
  assets: z
    .array(
      z.object({
        id: z.number(),
        node_id: z.string().optional(),
        name: z.string(),
        content_type: z.string().optional(),
        size: z.number().optional(),
        download_count: z.number().optional(),
        created_at: z.string().optional(),
        updated_at: z.string().optional(),
        browser_download_url: z.string().optional(),
      }),
    )
    .optional(),
});

export function getReleaseTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_get_release',
    description: 'Retrieve a single release by release ID.',
    inputSchema: getReleaseInputSchema,
    outputSchema: getReleaseOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getReleaseOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/releases/releases#get-a-release
      const response = await platformProxy.get({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/releases/${encodeURIComponent(String(input.release_id))}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Release not found',
          release_id: input.release_id,
        });
      }

      const providerRelease = ProviderReleaseSchema.parse(response.data);

      return {
        id: providerRelease.id,
        ...(providerRelease.node_id !== undefined && { node_id: providerRelease.node_id }),
        ...(providerRelease.tag_name !== undefined && { tag_name: providerRelease.tag_name }),
        ...(providerRelease.name != null && { name: providerRelease.name }),
        ...(providerRelease.body != null && { body: providerRelease.body }),
        ...(providerRelease.draft !== undefined && { draft: providerRelease.draft }),
        ...(providerRelease.prerelease !== undefined && { prerelease: providerRelease.prerelease }),
        ...(providerRelease.created_at !== undefined && { created_at: providerRelease.created_at }),
        ...(providerRelease.published_at != null && { published_at: providerRelease.published_at }),
        ...(providerRelease.author !== undefined && { author: providerRelease.author }),
        ...(providerRelease.html_url !== undefined && { html_url: providerRelease.html_url }),
        ...(providerRelease.tarball_url != null && { tarball_url: providerRelease.tarball_url }),
        ...(providerRelease.zipball_url != null && { zipball_url: providerRelease.zipball_url }),
        ...(providerRelease.assets !== undefined && { assets: providerRelease.assets }),
      };
    },
  });
}
