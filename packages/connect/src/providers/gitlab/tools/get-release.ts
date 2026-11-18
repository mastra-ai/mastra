// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

/** Encodes one GitLab path segment exactly once, whether `value` arrives raw or already URL-encoded. */
function gitlabPathSegment(value: string | number): string {
  const text = String(value);
  try {
    return encodeURIComponent(decodeURIComponent(text));
  } catch {
    return encodeURIComponent(text);
  }
}

export const getReleaseInputSchema = z.object({
  project_id: z
    .union([
      z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      z
        .string()
        .min(1)
        .refine(value => {
          try {
            encodeURIComponent(value);
            return true;
          } catch {
            return false;
          }
        }, 'must not contain unpaired surrogate characters'),
    ])
    .describe(
      'Numeric project ID, or the project path raw or URL-encoded. Example: 82599306, "team/app", or "team%2Fapp"',
    ),
  tag_name: z.string().describe('The Git tag the release is associated with. Example: "v1.0.0"'),
});

const ProviderAuthorSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  username: z.string().optional(),
  state: z.string().optional(),
  avatar_url: z.string().optional(),
  web_url: z.string().optional(),
});

const ProviderCommitSchema = z.object({
  id: z.string(),
  short_id: z.string().optional(),
  title: z.string().optional(),
  created_at: z.string().optional(),
  parent_ids: z.array(z.string()).optional(),
  message: z.string().optional(),
  author_name: z.string().optional(),
  author_email: z.string().optional(),
  authored_date: z.string().optional(),
  committer_name: z.string().optional(),
  committer_email: z.string().optional(),
  committed_date: z.string().optional(),
});

const ProviderMilestoneSchema = z.object({
  id: z.number(),
  iid: z.number().optional(),
  project_id: z.number().optional(),
  title: z.string().optional(),
  description: z.string().nullish(),
  state: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  due_date: z.string().nullish(),
  start_date: z.string().nullish(),
  web_url: z.string().optional(),
  issue_stats: z
    .object({
      total: z.number().optional(),
      closed: z.number().optional(),
      opened: z.number().optional(),
    })
    .optional(),
});

const ProviderAssetSourceSchema = z.object({
  format: z.string().optional(),
  url: z.string().optional(),
});

const ProviderAssetLinkSchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  url: z.string().optional(),
  link_type: z.string().optional(),
  direct_asset_path: z.string().optional(),
});

const ProviderAssetsSchema = z.object({
  count: z.number().optional(),
  sources: z.array(ProviderAssetSourceSchema).optional(),
  links: z.array(ProviderAssetLinkSchema).optional(),
  evidence_file_path: z.string().optional(),
});

const ProviderEvidenceSchema = z.object({
  sha: z.string().optional(),
  filepath: z.string().optional(),
  collected_at: z.string().optional(),
});

const ProviderLinksSchema = z.object({
  closed_issues_url: z.string().optional(),
  closed_merge_requests_url: z.string().optional(),
  edit_url: z.string().optional(),
  merged_merge_requests_url: z.string().optional(),
  opened_issues_url: z.string().optional(),
  opened_merge_requests_url: z.string().optional(),
  self: z.string().optional(),
});

const ProviderReleaseSchema = z.object({
  tag_name: z.string(),
  description: z.string().nullish(),
  name: z.string().optional(),
  created_at: z.string().optional(),
  released_at: z.string().optional(),
  author: ProviderAuthorSchema.optional(),
  commit: ProviderCommitSchema.optional(),
  milestones: z.array(ProviderMilestoneSchema).optional(),
  commit_path: z.string().optional(),
  tag_path: z.string().optional(),
  assets: ProviderAssetsSchema.optional(),
  evidences: z.array(ProviderEvidenceSchema).optional(),
  evidence_sha: z.string().optional(),
  upcoming_release: z.boolean().optional(),
  historical_release: z.boolean().optional(),
  _links: ProviderLinksSchema.optional(),
});

export const getReleaseOutputSchema = ProviderReleaseSchema;

export function getReleaseTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_get_release',
    description: 'Retrieve a single release from GitLab.',
    inputSchema: getReleaseInputSchema,
    outputSchema: getReleaseOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getReleaseOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = typeof input.project_id === 'number' ? String(input.project_id) : input.project_id;
      // https://docs.gitlab.com/api/releases/#get-a-release-by-a-tag-name
      const response = await platformProxy.get({
        endpoint: `/api/v4/projects/${gitlabPathSegment(projectId)}/releases/${encodeURIComponent(String(input.tag_name))}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Release not found',
          project_id: String(input.project_id),
          tag_name: input.tag_name,
        });
      }

      const providerRelease = ProviderReleaseSchema.parse(response.data);

      return providerRelease;
    },
  });
}
