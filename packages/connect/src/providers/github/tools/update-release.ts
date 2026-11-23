// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateReleaseInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "viictoo"'),
  repo: z.string().describe('The name of the repository. Example: "api-playground2"'),
  release_id: z.number().describe('The unique identifier of the release. Example: 12345678'),
  tag_name: z.string().optional().describe('The name of the tag.'),
  target_commitish: z
    .string()
    .optional()
    .describe('The commitish value that determines where the Git tag is created from.'),
  name: z.string().nullable().optional().describe('The name of the release. Pass null to clear.'),
  body: z.string().nullable().optional().describe('Text describing the contents of the tag. Pass null to clear.'),
  draft: z.boolean().optional().describe('true makes the release a draft, false publishes the release.'),
  prerelease: z
    .boolean()
    .optional()
    .describe('true to identify the release as a prerelease, false for a full release.'),
  make_latest: z
    .enum(['true', 'false', 'legacy'])
    .optional()
    .describe('Whether this release should be set as the latest release.'),
  discussion_category_name: z.string().optional().describe('A category for discussion linked to the release.'),
});

const ProviderReleaseSchema = z
  .object({
    id: z.number(),
    node_id: z.string(),
    tag_name: z.string(),
    target_commitish: z.string(),
    name: z.string().nullable(),
    body: z.string().nullable(),
    draft: z.boolean(),
    prerelease: z.boolean(),
    created_at: z.string(),
    published_at: z.string().nullable(),
    updated_at: z.string().nullable(),
    url: z.string(),
    html_url: z.string(),
    assets_url: z.string(),
    upload_url: z.string(),
    tarball_url: z.string().nullable(),
    zipball_url: z.string().nullable(),
    author: z
      .object({
        login: z.string(),
        id: z.number(),
        node_id: z.string(),
        avatar_url: z.string(),
        gravatar_id: z.string().nullable(),
        url: z.string(),
        html_url: z.string(),
        type: z.string(),
      })
      .passthrough(),
    assets: z.array(z.object({}).passthrough()),
  })
  .passthrough();

export const updateReleaseOutputSchema = z.object({
  id: z.number().describe('The unique identifier of the release.'),
  node_id: z.string().describe('The node ID of the release.'),
  tag_name: z.string().describe('The name of the tag.'),
  target_commitish: z.string().describe('The commitish value for the tag.'),
  name: z.string().optional().describe('The name of the release.'),
  body: z.string().optional().describe('The body/description of the release.'),
  draft: z.boolean().describe('Whether the release is a draft.'),
  prerelease: z.boolean().describe('Whether the release is a prerelease.'),
  created_at: z.string().describe('The creation timestamp.'),
  published_at: z.string().optional().describe('The publication timestamp.'),
  updated_at: z.string().optional().describe('The last update timestamp.'),
  url: z.string().describe('The API URL for the release.'),
  html_url: z.string().describe('The HTML URL for the release.'),
  assets_url: z.string().describe('The assets URL for the release.'),
  upload_url: z.string().describe('The upload URL for the release.'),
  tarball_url: z.string().optional().describe('The tarball URL.'),
  zipball_url: z.string().optional().describe('The zipball URL.'),
  author: z
    .object({
      login: z.string(),
      id: z.number(),
      node_id: z.string(),
      avatar_url: z.string(),
      gravatar_id: z.string().optional(),
      url: z.string(),
      html_url: z.string(),
      type: z.string(),
    })
    .passthrough(),
  assets: z.array(z.object({}).passthrough()),
});

export function updateReleaseTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_update_release',
    description: 'Edit release metadata such as name, notes, or draft state.',
    inputSchema: updateReleaseInputSchema,
    outputSchema: updateReleaseOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateReleaseOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const body: Record<string, unknown> = {};

      if (input.tag_name !== undefined) {
        body['tag_name'] = input.tag_name;
      }
      if (input.target_commitish !== undefined) {
        body['target_commitish'] = input.target_commitish;
      }
      if (input.name !== undefined) {
        body['name'] = input.name;
      }
      if (input.body !== undefined) {
        body['body'] = input.body;
      }
      if (input.draft !== undefined) {
        body['draft'] = input.draft;
      }
      if (input.prerelease !== undefined) {
        body['prerelease'] = input.prerelease;
      }
      if (input.make_latest !== undefined) {
        body['make_latest'] = input.make_latest;
      }
      if (input.discussion_category_name !== undefined) {
        body['discussion_category_name'] = input.discussion_category_name;
      }

      // https://docs.github.com/en/rest/releases/releases#update-a-release
      const response = await platformProxy.patch({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/releases/${input.release_id}`,
        data: body,
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
        node_id: providerRelease.node_id,
        tag_name: providerRelease.tag_name,
        target_commitish: providerRelease.target_commitish,
        ...(providerRelease.name != null && { name: providerRelease.name }),
        ...(providerRelease.body != null && { body: providerRelease.body }),
        draft: providerRelease.draft,
        prerelease: providerRelease.prerelease,
        created_at: providerRelease.created_at,
        ...(providerRelease.published_at != null && { published_at: providerRelease.published_at }),
        ...(providerRelease.updated_at != null && { updated_at: providerRelease.updated_at }),
        url: providerRelease.url,
        html_url: providerRelease.html_url,
        assets_url: providerRelease.assets_url,
        upload_url: providerRelease.upload_url,
        ...(providerRelease.tarball_url != null && { tarball_url: providerRelease.tarball_url }),
        ...(providerRelease.zipball_url != null && { zipball_url: providerRelease.zipball_url }),
        author: {
          login: providerRelease.author.login,
          id: providerRelease.author.id,
          node_id: providerRelease.author.node_id,
          avatar_url: providerRelease.author.avatar_url,
          ...(providerRelease.author.gravatar_id != null && { gravatar_id: providerRelease.author.gravatar_id }),
          url: providerRelease.author.url,
          html_url: providerRelease.author.html_url,
          type: providerRelease.author.type,
        },
        assets: providerRelease.assets,
      };
    },
  });
}
