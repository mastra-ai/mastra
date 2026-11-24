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

export const listJobsInputSchema = z.object({
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
  scope: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe('Job status scope(s) to filter by'),
  cursor: z
    .string()
    .regex(/^[1-9]\d*$/, 'cursor must be the page number from next_cursor')
    .optional()
    .describe('Pagination cursor (page number)'),
  per_page: z.number().optional().describe('Number of results per page. Default: 20'),
});

const PipelineSchema = z.object({
  id: z.number(),
  project_id: z.number(),
  ref: z.string(),
  sha: z.string(),
  status: z.string(),
});

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  username: z.string(),
  avatar_url: z.string().optional(),
});

const JobSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.string(),
  stage: z.string(),
  ref: z.string(),
  tag: z.boolean(),
  coverage: z.number().nullable().optional(),
  allow_failure: z.boolean(),
  created_at: z.string().optional(),
  started_at: z.string().nullable().optional(),
  finished_at: z.string().nullable().optional(),
  duration: z.number().nullable().optional(),
  queued_duration: z.number().nullable().optional(),
  web_url: z.string().optional(),
  failure_reason: z.string().nullable().optional(),
  user: UserSchema.nullable().optional(),
  pipeline: PipelineSchema.optional(),
});

export const listJobsOutputSchema = z.object({
  items: z.array(JobSchema),
  next_cursor: z.string().optional(),
});

export function listJobsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_list_jobs',
    description: 'List jobs from GitLab, newest first.',
    inputSchema: listJobsInputSchema,
    outputSchema: listJobsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listJobsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.gitlab.com/api/jobs/
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/jobs`,
        params: {
          ...(input.scope !== undefined && { 'scope[]': input.scope }),
          ...(input.per_page !== undefined && { per_page: input.per_page }),
          ...(input.cursor !== undefined && { page: input.cursor }),
        },
        retries: 3,
      });
      fillGitLabNextPage(response.headers);

      const rawData = z.array(z.unknown()).parse(response.data);
      const items = rawData.map(item => JobSchema.parse(item));

      const nextPage = response.headers['x-next-page'] || response.headers['X-Next-Page'];
      const next_cursor = typeof nextPage === 'string' && nextPage.length > 0 ? nextPage : undefined;

      return {
        items,
        ...(next_cursor !== undefined && { next_cursor }),
      };
    },
  });
}
