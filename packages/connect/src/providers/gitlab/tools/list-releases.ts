// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

/** Fills x-next-page from the Link header when GitLab sends only Link (keyset pagination, large result sets). */
function fillGitLabNextPage(headers: Record<string, string>): void {
  if (headers['x-next-page']) return;
  const next = /<([^>]+)>;\s*rel="next"/.exec(headers['link'] ?? '')?.[1];
  const page = next ? new URL(next).searchParams.get('page') : null;
  if (page) headers['x-next-page'] = page;
}

/** Encodes one GitLab path segment exactly once, whether `value` arrives raw or already URL-encoded. */
function gitlabPathSegment(value: string | number): string {
  const text = String(value);
  try {
    return encodeURIComponent(decodeURIComponent(text));
  } catch {
    return encodeURIComponent(text);
  }
}

export const listReleasesInputSchema = z.object({
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
  cursor: z
    .string()
    .regex(/^[1-9]\d*$/, 'cursor must be the page number from next_cursor')
    .optional()
    .describe('Pagination cursor (page number) from the previous response. Omit for the first page.'),
  order_by: z
    .enum(['released_at', 'created_at'])
    .optional()
    .describe('The field to use as order. Either released_at (default) or created_at.'),
  sort: z.enum(['asc', 'desc']).optional().describe('The direction of the order. Either desc (default) or asc.'),
  per_page: z.number().min(1).max(100).optional().describe('Number of items to list per page (default: 20, max: 100).'),
  include_html_description: z
    .boolean()
    .optional()
    .describe('If true, a response includes HTML rendered Markdown of the release description.'),
});

const ProviderAuthorSchema = z.object({
  id: z.number(),
  name: z.string(),
  username: z.string(),
  state: z.string().optional(),
  avatar_url: z.string().optional(),
  web_url: z.string().optional(),
});

const ProviderCommitSchema = z.object({
  id: z.string(),
  short_id: z.string(),
  title: z.string(),
  created_at: z.string().optional(),
  message: z.string().optional(),
  author_name: z.string().optional(),
  author_email: z.string().optional(),
});

const ProviderReleaseSchema = z.object({
  tag_name: z.string(),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  created_at: z.string(),
  released_at: z.string(),
  author: ProviderAuthorSchema.nullable().optional(),
  commit: ProviderCommitSchema.nullable().optional(),
  upcoming_release: z.boolean().optional(),
  historical_release: z.boolean().optional(),
});

const ReleaseOutputSchema = z.object({
  tag_name: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  created_at: z.string(),
  released_at: z.string(),
  author: z
    .object({
      id: z.number(),
      name: z.string(),
      username: z.string(),
      state: z.string().optional(),
      avatar_url: z.string().optional(),
      web_url: z.string().optional(),
    })
    .optional(),
  commit: z
    .object({
      id: z.string(),
      short_id: z.string(),
      title: z.string(),
      created_at: z.string().optional(),
      message: z.string().optional(),
      author_name: z.string().optional(),
      author_email: z.string().optional(),
    })
    .optional(),
  upcoming_release: z.boolean().optional(),
  historical_release: z.boolean().optional(),
});

export const listReleasesOutputSchema = z.object({
  releases: z.array(ReleaseOutputSchema),
  next_cursor: z.string().optional(),
});

export function listReleasesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_list_releases',
    description: 'List releases from GitLab.',
    inputSchema: listReleasesInputSchema,
    outputSchema: listReleasesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listReleasesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.gitlab.com/api/releases/
      const response = await platformProxy.get({
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/releases`,
        params: {
          ...(input.cursor !== undefined && { page: input.cursor }),
          ...(input.order_by !== undefined && { order_by: input.order_by }),
          ...(input.sort !== undefined && { sort: input.sort }),
          ...(input.per_page !== undefined && { per_page: String(input.per_page) }),
          ...(input.include_html_description !== undefined && {
            include_html_description: String(input.include_html_description),
          }),
        },
        retries: 3,
      });
      fillGitLabNextPage(response.headers);

      const providerReleases = z.array(ProviderReleaseSchema).parse(response.data);

      const releases = providerReleases.map(release => ({
        tag_name: release.tag_name,
        created_at: release.created_at,
        released_at: release.released_at,
        ...(release.name != null && { name: release.name }),
        ...(release.description != null && { description: release.description }),
        ...(release.author != null && {
          author: {
            id: release.author.id,
            name: release.author.name,
            username: release.author.username,
            ...(release.author.state !== undefined && { state: release.author.state }),
            ...(release.author.avatar_url !== undefined && { avatar_url: release.author.avatar_url }),
            ...(release.author.web_url !== undefined && { web_url: release.author.web_url }),
          },
        }),
        ...(release.commit != null && {
          commit: {
            id: release.commit.id,
            short_id: release.commit.short_id,
            title: release.commit.title,
            ...(release.commit.created_at !== undefined && { created_at: release.commit.created_at }),
            ...(release.commit.message !== undefined && { message: release.commit.message }),
            ...(release.commit.author_name !== undefined && { author_name: release.commit.author_name }),
            ...(release.commit.author_email !== undefined && { author_email: release.commit.author_email }),
          },
        }),
        ...(release.upcoming_release !== undefined && { upcoming_release: release.upcoming_release }),
        ...(release.historical_release !== undefined && { historical_release: release.historical_release }),
      }));

      const nextPage = response.headers['x-next-page'];
      const next_cursor = typeof nextPage === 'string' && nextPage.length > 0 ? nextPage : undefined;

      return {
        releases,
        ...(next_cursor !== undefined && { next_cursor }),
      };
    },
  });
}
