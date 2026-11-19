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

export const listMergeRequestsInputSchema = z.object({
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
  state: z
    .enum(['all', 'opened', 'closed', 'locked', 'merged'])
    .optional()
    .describe('Return all merge requests or just those with the given state.'),
  target_branch: z.string().optional().describe('Return merge requests with the given target branch.'),
  source_branch: z.string().optional().describe('Return merge requests with the given source branch.'),
  search: z.string().optional().describe('Search merge requests against their title and description.'),
  cursor: z
    .string()
    .regex(/^[1-9]\d*$/, 'cursor must be the page number from next_cursor')
    .optional()
    .describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const GitLabUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  username: z.string(),
  state: z.string(),
  avatar_url: z.string().nullable().optional(),
  web_url: z.string(),
});

const ReferencesSchema = z.object({
  short: z.string(),
  relative: z.string(),
  full: z.string(),
});

const MergeRequestSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  state: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  merged_at: z.string().nullable(),
  closed_at: z.string().nullable(),
  target_branch: z.string(),
  source_branch: z.string(),
  author: GitLabUserSchema,
  assignees: z.array(GitLabUserSchema).nullable().optional(),
  reviewers: z.array(GitLabUserSchema).nullable().optional(),
  labels: z.array(z.string()).nullable().optional(),
  draft: z.boolean(),
  work_in_progress: z.boolean().nullable().optional(),
  web_url: z.string(),
  sha: z.string().nullable(),
  merge_commit_sha: z.string().nullable(),
  squash_commit_sha: z.string().nullable().optional(),
  source_project_id: z.number(),
  target_project_id: z.number(),
  upvotes: z.number(),
  downvotes: z.number(),
  user_notes_count: z.number(),
  references: ReferencesSchema,
  detailed_merge_status: z.string().nullable().optional(),
  merge_status: z.string().nullable().optional(),
  has_conflicts: z.boolean().nullable().optional(),
  blocking_discussions_resolved: z.boolean().nullable().optional(),
  merge_when_pipeline_succeeds: z.boolean().nullable().optional(),
  should_remove_source_branch: z.boolean().nullable().optional(),
  force_remove_source_branch: z.boolean().nullable().optional(),
  allow_collaboration: z.boolean().nullable().optional(),
  squash: z.boolean().nullable().optional(),
  squash_on_merge: z.boolean().nullable().optional(),
  imported: z.boolean().nullable().optional(),
  imported_from: z.string().nullable().optional(),
});

export const listMergeRequestsOutputSchema = z.object({
  items: z.array(MergeRequestSchema),
  next_cursor: z.string().optional(),
});

export function listMergeRequestsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_list_merge_requests',
    description: 'List merge requests from GitLab.',
    inputSchema: listMergeRequestsInputSchema,
    outputSchema: listMergeRequestsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listMergeRequestsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const page = input.cursor ? parseInt(input.cursor, 10) : 1;
      if (isNaN(page) || page < 1) {
        throw new platformProxy.ActionError({
          type: 'invalid_cursor',
          message: 'cursor must be a valid page number',
        });
      }

      // https://docs.gitlab.com/api/merge_requests/#list-project-merge-requests
      const response = await platformProxy.get({
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/merge_requests`,
        params: {
          page: String(page),
          per_page: '20',
          ...(input.state !== undefined && { state: input.state }),
          ...(input.target_branch !== undefined && { target_branch: input.target_branch }),
          ...(input.source_branch !== undefined && { source_branch: input.source_branch }),
          ...(input.search !== undefined && { search: input.search }),
        },
        retries: 3,
      });
      fillGitLabNextPage(response.headers);

      const parsedItems = z.array(MergeRequestSchema).safeParse(response.data);
      if (!parsedItems.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: `Failed to parse merge requests: ${parsedItems.error.message}`,
        });
      }

      const rawNextPage = response.headers['x-next-page'];
      const nextCursor =
        rawNextPage !== undefined && rawNextPage !== null && String(rawNextPage).length > 0
          ? String(rawNextPage)
          : undefined;

      return {
        items: parsedItems.data,
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      };
    },
  });
}
