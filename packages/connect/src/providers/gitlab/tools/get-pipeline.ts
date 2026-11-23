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

export const getPipelineInputSchema = z.object({
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
  pipeline_id: z.number().describe('The ID of the pipeline. Example: 287'),
});

const PipelineUserSchema = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string(),
  state: z.string(),
  avatar_url: z.string(),
  web_url: z.string(),
});

const PipelineDetailedStatusSchema = z.object({
  icon: z.string(),
  text: z.string(),
  label: z.string(),
  group: z.string(),
  tooltip: z.string(),
  has_details: z.boolean(),
  details_path: z.string(),
  illustration: z.string().nullable().optional(),
  favicon: z.string().nullable().optional(),
});

export const getPipelineOutputSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number(),
  name: z.string().nullable().optional(),
  sha: z.string(),
  ref: z.string(),
  status: z.string(),
  source: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  web_url: z.string(),
  before_sha: z.string(),
  tag: z.boolean(),
  yaml_errors: z.string().nullable().optional(),
  user: PipelineUserSchema.nullable().optional(),
  started_at: z.string().nullable().optional(),
  finished_at: z.string().nullable().optional(),
  committed_at: z.string().nullable().optional(),
  duration: z.number().nullable().optional(),
  queued_duration: z.number().nullable().optional(),
  coverage: z.string().nullable().optional(),
  detailed_status: PipelineDetailedStatusSchema.nullable().optional(),
  archived: z.boolean(),
});

export function getPipelineTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_get_pipeline',
    description: 'Retrieve a single pipeline from GitLab.',
    inputSchema: getPipelineInputSchema,
    outputSchema: getPipelineOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getPipelineOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.gitlab.com/api/pipelines/#retrieve-a-single-pipeline
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/pipelines/${encodeURIComponent(String(input.pipeline_id))}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Pipeline not found',
          project_id: String(input.project_id),
          pipeline_id: input.pipeline_id,
        });
      }

      const pipeline = getPipelineOutputSchema.parse(response.data);
      return pipeline;
    },
  });
}
