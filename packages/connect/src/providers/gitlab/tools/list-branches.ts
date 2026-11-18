// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

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

export const listBranchesInputSchema = z.object({
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
    .describe('Pagination cursor (page number). Omit for the first page.'),
  per_page: z.number().optional().describe('Number of results per page. Default: 20, max: 100.'),
  search: z.string().optional().describe('Search string to filter branches.'),
  regex: z.string().optional().describe('Regular expression to filter branch names. Cannot be used with search.'),
});

const ProviderCommitSchema = z.object({
  id: z.string(),
  short_id: z.string(),
  created_at: z.string().optional(),
  parent_ids: z.array(z.string()).optional(),
  title: z.string(),
  message: z.string(),
  author_name: z.string().optional(),
  author_email: z.string().optional(),
  authored_date: z.string().optional(),
  committer_name: z.string().optional(),
  committer_email: z.string().optional(),
  committed_date: z.string().optional(),
  trailers: z.object({}).passthrough().optional(),
  extended_trailers: z.object({}).passthrough().optional(),
  web_url: z.string().optional(),
});

const ProviderBranchSchema = z.object({
  name: z.string(),
  merged: z.boolean(),
  protected: z.boolean(),
  default: z.boolean(),
  developers_can_push: z.boolean(),
  developers_can_merge: z.boolean(),
  can_push: z.boolean(),
  web_url: z.string(),
  commit: ProviderCommitSchema,
});

const OutputBranchSchema = z.object({
  name: z.string(),
  merged: z.boolean(),
  protected: z.boolean(),
  default: z.boolean(),
  developers_can_push: z.boolean(),
  developers_can_merge: z.boolean(),
  can_push: z.boolean(),
  web_url: z.string(),
  commit: z
    .object({
      id: z.string(),
      short_id: z.string(),
      title: z.string(),
      message: z.string(),
      author_name: z.string().optional(),
      author_email: z.string().optional(),
      authored_date: z.string().optional(),
      committed_date: z.string().optional(),
      web_url: z.string().optional(),
    })
    .optional(),
});

export const listBranchesOutputSchema = z.object({
  items: z.array(OutputBranchSchema),
  next_cursor: z.string().optional(),
});

export function listBranchesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_list_branches',
    description: 'List branches from GitLab.',
    inputSchema: listBranchesInputSchema,
    outputSchema: listBranchesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listBranchesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = String(input.project_id);
      const page = input.cursor ? Number(input.cursor) : 1;
      if (Number.isNaN(page) || !Number.isInteger(page) || page < 1) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'cursor must be a valid positive integer page number',
        });
      }

      const perPage = input.per_page ?? 20;

      if (input.search !== undefined && input.regex !== undefined) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'search and regex are mutually exclusive',
        });
      }

      const config: PlatformProxyRequest = {
        // https://docs.gitlab.com/api/branches/#list-all-repository-branches
        endpoint: `/api/v4/projects/${gitlabPathSegment(projectId)}/repository/branches`,
        params: {
          page: String(page),
          per_page: String(perPage),
          ...(input.search !== undefined && { search: input.search }),
          ...(input.regex !== undefined && { regex: input.regex }),
        },
        retries: 3,
      };

      const response = await platformProxy.get(config);
      fillGitLabNextPage(response.headers);

      if (!Array.isArray(response.data)) {
        throw new platformProxy.ActionError({
          type: 'unexpected_response',
          message: 'Expected an array of branches from GitLab',
        });
      }

      const providerBranches = response.data.map(item => {
        const parsed = ProviderBranchSchema.safeParse(item);
        if (!parsed.success) {
          throw new platformProxy.ActionError({
            type: 'unexpected_response',
            message: `Invalid branch response shape: ${parsed.error.message}`,
          });
        }
        return parsed.data;
      });

      const nextPage = response.headers['x-next-page'];
      const nextCursor = typeof nextPage === 'string' && nextPage.length > 0 ? nextPage : undefined;

      return {
        items: providerBranches.map(branch => ({
          name: branch.name,
          merged: branch.merged,
          protected: branch.protected,
          default: branch.default,
          developers_can_push: branch.developers_can_push,
          developers_can_merge: branch.developers_can_merge,
          can_push: branch.can_push,
          web_url: branch.web_url,
          ...(branch.commit !== undefined && {
            commit: {
              id: branch.commit.id,
              short_id: branch.commit.short_id,
              title: branch.commit.title,
              message: branch.commit.message,
              ...(branch.commit.author_name !== undefined && { author_name: branch.commit.author_name }),
              ...(branch.commit.author_email !== undefined && { author_email: branch.commit.author_email }),
              ...(branch.commit.authored_date !== undefined && { authored_date: branch.commit.authored_date }),
              ...(branch.commit.committed_date !== undefined && { committed_date: branch.commit.committed_date }),
              ...(branch.commit.web_url !== undefined && { web_url: branch.commit.web_url }),
            },
          }),
        })),
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      };
    },
  });
}
