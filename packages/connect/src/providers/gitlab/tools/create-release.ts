// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const AssetLinkInputSchema = z.object({
  name: z.string(),
  url: z.string(),
  direct_asset_path: z.string().optional(),
  link_type: z.string().optional(),
});

export const createReleaseInputSchema = z.object({
  project_id: z
    .union([z.string(), z.number()])
    .describe('The ID or URL-encoded path of the project. Example: 82599306'),
  tag_name: z.string().describe('The Git tag the release is associated with. Example: "v1.0.0"'),
  name: z.string().optional(),
  tag_message: z.string().optional(),
  description: z.string().optional(),
  ref: z.string().optional().describe('Commit SHA, branch name, or tag name. Required if tag_name does not exist.'),
  milestones: z.array(z.string()).optional(),
  assets_links: z.array(AssetLinkInputSchema).optional(),
  released_at: z.string().optional().describe('ISO 8601 datetime. Example: "2019-03-15T08:00:00Z"'),
});

const ProviderReleaseSchema = z
  .object({
    tag_name: z.string(),
    description: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    created_at: z.string().optional(),
    released_at: z.string().nullable().optional(),
    commit_path: z.string().optional(),
    tag_path: z.string().optional(),
    evidence_sha: z.string().optional(),
  })
  .passthrough();

export const createReleaseOutputSchema = z.object({
  tag_name: z.string(),
  description: z.string().optional(),
  name: z.string().optional(),
  created_at: z.string().optional(),
  released_at: z.string().optional(),
  commit_path: z.string().optional(),
  tag_path: z.string().optional(),
  evidence_sha: z.string().optional(),
});

export function createReleaseTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_create_release',
    description: 'Create a release in GitLab.',
    inputSchema: createReleaseInputSchema,
    outputSchema: createReleaseOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createReleaseOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = String(input.project_id);

      const data: Record<string, unknown> = {
        tag_name: input.tag_name,
      };

      if (input.name !== undefined) {
        data['name'] = input.name;
      }
      if (input.tag_message !== undefined) {
        data['tag_message'] = input.tag_message;
      }
      if (input.description !== undefined) {
        data['description'] = input.description;
      }
      if (input.ref !== undefined) {
        data['ref'] = input.ref;
      }
      if (input.milestones !== undefined) {
        data['milestones'] = input.milestones;
      }
      if (input.assets_links !== undefined) {
        data['assets'] = {
          links: input.assets_links.map(link => ({
            name: link.name,
            url: link.url,
            ...(link.direct_asset_path !== undefined && { direct_asset_path: link.direct_asset_path }),
            ...(link.link_type !== undefined && { link_type: link.link_type }),
          })),
        };
      }
      if (input.released_at !== undefined) {
        data['released_at'] = input.released_at;
      }

      const response = await platformProxy.post({
        // https://docs.gitlab.com/api/releases/#create-a-release
        endpoint: `/api/v4/projects/${projectId}/releases`,
        data,
        retries: 3,
      });

      const providerRelease = ProviderReleaseSchema.parse(response.data);

      return {
        tag_name: providerRelease.tag_name,
        ...(providerRelease.description != null && { description: providerRelease.description }),
        ...(providerRelease.name != null && { name: providerRelease.name }),
        ...(providerRelease.created_at != null && { created_at: providerRelease.created_at }),
        ...(providerRelease.released_at != null && { released_at: providerRelease.released_at }),
        ...(providerRelease.commit_path != null && { commit_path: providerRelease.commit_path }),
        ...(providerRelease.tag_path != null && { tag_path: providerRelease.tag_path }),
        ...(providerRelease.evidence_sha != null && { evidence_sha: providerRelease.evidence_sha }),
      };
    },
  });
}
