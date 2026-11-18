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

export const getJobInputSchema = z.object({
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
  job_id: z.number().describe('Job ID. Example: 1'),
});

const CommitSchema = z
  .object({
    author_email: z.string().nullable().optional(),
    author_name: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    id: z.string().optional(),
    message: z.string().nullable().optional(),
    short_id: z.string().optional(),
    title: z.string().nullable().optional(),
  })
  .passthrough();

const ArtifactsFileSchema = z
  .object({
    filename: z.string().optional(),
    size: z.number().optional(),
  })
  .passthrough();

const ArtifactSchema = z
  .object({
    file_type: z.string().optional(),
    size: z.number().optional(),
    filename: z.string().optional(),
    file_format: z.string().optional(),
  })
  .passthrough();

const PipelineSchema = z
  .object({
    id: z.number().optional(),
    project_id: z.number().optional(),
    ref: z.string().optional(),
    sha: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

const RunnerSchema = z
  .object({
    id: z.number().optional(),
    description: z.string().nullable().optional(),
    ip_address: z.string().nullable().optional(),
    active: z.boolean().optional(),
    paused: z.boolean().optional(),
    is_shared: z.boolean().optional(),
    runner_type: z.string().optional(),
    name: z.string().nullable().optional(),
    online: z.boolean().optional(),
    status: z.string().optional(),
  })
  .passthrough();

const RunnerManagerSchema = z
  .object({
    id: z.number().optional(),
    system_id: z.string().optional(),
    version: z.string().optional(),
    revision: z.string().optional(),
    platform: z.string().optional(),
    architecture: z.string().optional(),
    created_at: z.string().optional(),
    contacted_at: z.string().optional(),
    ip_address: z.string().nullable().optional(),
    status: z.string().optional(),
  })
  .passthrough();

const ProjectSchema = z
  .object({
    ci_job_token_scope_enabled: z.boolean().optional(),
  })
  .passthrough();

const UserSchema = z
  .object({
    id: z.number().optional(),
    name: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
    state: z.string().optional(),
    avatar_url: z.string().nullable().optional(),
    web_url: z.string().nullable().optional(),
    created_at: z.string().optional(),
    bio: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    public_email: z.string().nullable().optional(),
    linkedin: z.string().nullable().optional(),
    twitter: z.string().nullable().optional(),
    website_url: z.string().nullable().optional(),
    organization: z.string().nullable().optional(),
  })
  .passthrough();

const ProviderJobSchema = z
  .object({
    commit: CommitSchema.nullable().optional(),
    coverage: z.number().nullable().optional(),
    archived: z.boolean().optional(),
    source: z.string().optional(),
    allow_failure: z.boolean().optional(),
    created_at: z.string().optional(),
    started_at: z.string().nullable().optional(),
    finished_at: z.string().nullable().optional(),
    erased_at: z.string().nullable().optional(),
    duration: z.number().nullable().optional(),
    queued_duration: z.number().nullable().optional(),
    artifacts_file: ArtifactsFileSchema.nullable().optional(),
    artifacts: z.array(ArtifactSchema).optional(),
    artifacts_expire_at: z.string().nullable().optional(),
    tag_list: z.array(z.string()).optional(),
    id: z.number(),
    name: z.string().optional(),
    pipeline: PipelineSchema.nullable().optional(),
    ref: z.string().optional(),
    runner: RunnerSchema.nullable().optional(),
    runner_manager: RunnerManagerSchema.nullable().optional(),
    stage: z.string().optional(),
    status: z.string().optional(),
    failure_reason: z.string().nullable().optional(),
    tag: z.boolean().optional(),
    web_url: z.string().optional(),
    project: ProjectSchema.nullable().optional(),
    user: UserSchema.nullable().optional(),
  })
  .passthrough();

export const getJobOutputSchema = ProviderJobSchema;

export function getJobTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_get_job',
    description: 'Retrieve a single job from GitLab.',
    inputSchema: getJobInputSchema,
    outputSchema: getJobOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getJobOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.gitlab.com/api/jobs/#retrieve-a-job-by-job-id
      const response = await platformProxy.get({
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/jobs/${encodeURIComponent(String(input.job_id))}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Job not found',
          project_id: String(input.project_id),
          job_id: input.job_id,
        });
      }

      const providerJob = ProviderJobSchema.parse(response.data);
      return providerJob;
    },
  });
}
