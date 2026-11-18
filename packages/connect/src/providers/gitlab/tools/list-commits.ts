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

export const listCommitsInputSchema = z.object({
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
  ref_name: z
    .string()
    .optional()
    .describe('The name of a repository branch or tag. If not given, the default branch is used.'),
  path: z.string().optional().describe('The file path. Example: hello.txt'),
  since: z.string().optional().describe('Only commits after this date. Format: ISO 8601 (YYYY-MM-DDTHH:MM:SSZ).'),
  until: z.string().optional().describe('Only commits before this date. Format: ISO 8601 (YYYY-MM-DDTHH:MM:SSZ).'),
  per_page: z.number().optional().describe('Number of results per page. Default: 20, max: 100.'),
  cursor: z
    .string()
    .regex(/^[1-9]\d*$/, 'cursor must be the page number from next_cursor')
    .optional()
    .describe('Pagination cursor (page number). Omit for the first page.'),
});

const ProviderCommitSchema = z.object({
  id: z.string(),
  short_id: z.string().optional(),
  title: z.string().optional(),
  message: z.string().optional(),
  author_name: z.string().optional(),
  author_email: z.string().optional(),
  authored_date: z.string().optional(),
  committer_name: z.string().optional(),
  committer_email: z.string().optional(),
  committed_date: z.string().optional(),
  created_at: z.string().optional(),
  parent_ids: z.array(z.string()).optional(),
  web_url: z.string().optional(),
});

export const listCommitsOutputSchema = z.object({
  commits: z.array(ProviderCommitSchema),
  next_cursor: z.string().optional(),
});

export function listCommitsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_list_commits',
    description: 'List commits from GitLab.',
    inputSchema: listCommitsInputSchema,
    outputSchema: listCommitsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listCommitsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.gitlab.com/api/commits/#list-repository-commits
      const response = await platformProxy.get({
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/repository/commits`,
        params: {
          ...(input.ref_name !== undefined && { ref_name: input.ref_name }),
          ...(input.path !== undefined && { path: input.path }),
          ...(input.since !== undefined && { since: input.since }),
          ...(input.until !== undefined && { until: input.until }),
          ...(input.per_page !== undefined && { per_page: String(input.per_page) }),
          ...(input.cursor !== undefined && { page: input.cursor }),
        },
        retries: 3,
      });
      fillGitLabNextPage(response.headers);

      const commits = z.array(ProviderCommitSchema).parse(response.data);

      const nextPage =
        typeof response.headers['x-next-page'] === 'string' && response.headers['x-next-page'] !== ''
          ? response.headers['x-next-page']
          : undefined;

      return {
        commits,
        ...(nextPage !== undefined && { next_cursor: nextPage }),
      };
    },
  });
}
