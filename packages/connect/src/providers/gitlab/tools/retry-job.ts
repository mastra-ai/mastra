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

export const retryJobInputSchema = z.object({
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
  job_id: z.number().describe('Job ID. Example: 12345'),
});

const ProviderUserSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    username: z.string(),
    state: z.string(),
    avatar_url: z.string().nullable().optional(),
  })
  .passthrough();

const ProviderCommitSchema = z
  .object({
    id: z.string(),
    short_id: z.string(),
    title: z.string(),
    message: z.string(),
    author_name: z.string(),
    authored_date: z.string(),
  })
  .passthrough();

const ProviderPipelineSchema = z
  .object({
    id: z.number(),
    sha: z.string(),
    ref: z.string(),
    status: z.string(),
  })
  .passthrough();

const ProviderJobSchema = z
  .object({
    id: z.number(),
    status: z.string(),
    stage: z.string(),
    name: z.string(),
    ref: z.string(),
    tag: z.boolean(),
    coverage: z.string().nullable().optional(),
    created_at: z.string(),
    started_at: z.string().nullable().optional(),
    finished_at: z.string().nullable().optional(),
    duration: z.number().nullable().optional(),
    queued_duration: z.number().nullable().optional(),
    user: ProviderUserSchema.nullish(),
    commit: ProviderCommitSchema.optional(),
    pipeline: ProviderPipelineSchema.optional(),
    web_url: z.string(),
  })
  .passthrough();

export const retryJobOutputSchema = ProviderJobSchema;

export function retryJobTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_retry_job',
    description: 'Retry a GitLab CI job.',
    inputSchema: retryJobInputSchema,
    outputSchema: retryJobOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof retryJobOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.gitlab.com/api/jobs/#retry-a-job
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/jobs/${encodeURIComponent(String(input.job_id))}/retry`,
        retries: 1,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Job not found or could not be retried',
          project_id: String(input.project_id),
          job_id: input.job_id,
        });
      }

      const providerJob = ProviderJobSchema.parse(response.data);

      return providerJob;
    },
  });
}
