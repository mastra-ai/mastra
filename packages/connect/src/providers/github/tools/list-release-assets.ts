// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listReleaseAssetsInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "octocat"'),
  repo: z.string().describe('The name of the repository. Example: "Hello-World"'),
  release_id: z.number().describe('The unique identifier of the release. Example: 1'),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('The number of results per page (max 100). Default: 30'),
  page: z.number().int().min(1).optional().describe('The page number of the results to fetch. Default: 1'),
});

const UploaderSchema = z.object({
  login: z.string(),
  id: z.number(),
  node_id: z.string(),
  avatar_url: z.string(),
  gravatar_id: z.string().nullable(),
  url: z.string(),
  html_url: z.string(),
  followers_url: z.string(),
  following_url: z.string(),
  gists_url: z.string(),
  starred_url: z.string(),
  subscriptions_url: z.string(),
  organizations_url: z.string(),
  repos_url: z.string(),
  events_url: z.string(),
  received_events_url: z.string(),
  type: z.string(),
  site_admin: z.boolean(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  starred_at: z.string().optional(),
  user_view_type: z.string().optional(),
});

const ProviderAssetSchema = z.object({
  url: z.string(),
  browser_download_url: z.string(),
  id: z.number(),
  node_id: z.string(),
  name: z.string(),
  label: z.string().nullable(),
  state: z.string(),
  content_type: z.string(),
  size: z.number(),
  digest: z.string().nullable(),
  download_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  uploader: UploaderSchema.nullable(),
});

const AssetSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  name: z.string(),
  label: z.string().optional(),
  state: z.string(),
  content_type: z.string(),
  size: z.number(),
  download_count: z.number(),
  browser_download_url: z.string(),
  url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const listReleaseAssetsOutputSchema = z.object({
  assets: z.array(AssetSchema),
  next_page: z.number().optional(),
});

export function listReleaseAssetsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_list_release_assets',
    description: 'List assets uploaded to a repository release.',
    inputSchema: listReleaseAssetsInputSchema,
    outputSchema: listReleaseAssetsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listReleaseAssetsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/releases/assets#list-release-assets
      const response = await platformProxy.get({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/releases/${encodeURIComponent(String(input.release_id))}/assets`,
        params: {
          ...(input.per_page !== undefined && { per_page: String(input.per_page) }),
          ...(input.page !== undefined && { page: String(input.page) }),
        },
        retries: 3,
      });

      if (!Array.isArray(response.data)) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Expected an array of assets from GitHub API',
        });
      }

      const assets: z.infer<typeof AssetSchema>[] = [];

      for (const item of response.data) {
        const parsed = ProviderAssetSchema.safeParse(item);
        if (parsed.success) {
          assets.push({
            id: parsed.data.id,
            node_id: parsed.data.node_id,
            name: parsed.data.name,
            ...(parsed.data.label != null && { label: parsed.data.label }),
            state: parsed.data.state,
            content_type: parsed.data.content_type,
            size: parsed.data.size,
            download_count: parsed.data.download_count,
            browser_download_url: parsed.data.browser_download_url,
            url: parsed.data.url,
            created_at: parsed.data.created_at,
            updated_at: parsed.data.updated_at,
          });
        }
      }

      const rawLink = response.headers?.['link'];
      const linkHeader = typeof rawLink === 'string' ? rawLink : undefined;
      const hasNextPage = linkHeader ? linkHeader.includes('rel="next"') : false;
      const currentPage = input.page ?? 1;

      return {
        assets,
        ...(hasNextPage && { next_page: currentPage + 1 }),
      };
    },
  });
}
