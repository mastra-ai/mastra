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

export const listJobsInputSchema = z.object({
  project_id: z.union([z.number(), z.string()]).describe('Project ID or URL-encoded namespace path. Example: 82599306'),
  scope: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe('Job status scope(s) to filter by'),
  order_by: z.string().optional().describe('Order results by a field. Example: "id"'),
  sort: z.string().optional().describe('Sort order. Example: "asc" or "desc"'),
  cursor: z.string().optional().describe('Pagination cursor (page number)'),
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
    description: 'List jobs from GitLab.',
    inputSchema: listJobsInputSchema,
    outputSchema: listJobsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listJobsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.gitlab.com/api/jobs/
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/jobs`,
        params: {
          ...(input.scope !== undefined && { scope: input.scope }),
          ...(input.order_by !== undefined && { order_by: input.order_by }),
          ...(input.sort !== undefined && { sort: input.sort }),
          ...(input.per_page !== undefined && { per_page: input.per_page }),
          ...(input.cursor !== undefined && { page: input.cursor }),
        },
        retries: 3,
      });

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
