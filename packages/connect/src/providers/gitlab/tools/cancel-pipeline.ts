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

export const cancelPipelineInputSchema = z.object({
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
  pipeline_id: z.number().describe('Pipeline ID. Example: 46'),
});

const ProviderUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  username: z.string(),
  state: z.string(),
  avatar_url: z.string().optional(),
  web_url: z.string().optional(),
});

const ProviderPipelineSchema = z
  .object({
    id: z.number(),
    iid: z.number(),
    project_id: z.number(),
    status: z.string(),
    ref: z.string().optional(),
    sha: z.string().optional(),
    before_sha: z.string().optional(),
    tag: z.boolean().optional(),
    yaml_errors: z.string().nullable().optional(),
    user: ProviderUserSchema.optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    started_at: z.string().nullable().optional(),
    finished_at: z.string().nullable().optional(),
    committed_at: z.string().nullable().optional(),
    duration: z.number().nullable().optional(),
    queued_duration: z.number().nullable().optional(),
    coverage: z.union([z.number(), z.string()]).nullish(),
    web_url: z.string().optional(),
    archived: z.boolean().optional(),
  })
  .passthrough();

export const cancelPipelineOutputSchema = ProviderPipelineSchema;

export function cancelPipelineTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_cancel_pipeline',
    description: 'Cancel a GitLab pipeline.',
    inputSchema: cancelPipelineInputSchema,
    outputSchema: cancelPipelineOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof cancelPipelineOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.gitlab.com/api/pipelines/#cancel-all-jobs-for-a-pipeline
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/pipelines/${encodeURIComponent(String(input.pipeline_id))}/cancel`,
        retries: 1,
      });

      const pipeline = ProviderPipelineSchema.parse(response.data);

      return pipeline;
    },
  });
}
