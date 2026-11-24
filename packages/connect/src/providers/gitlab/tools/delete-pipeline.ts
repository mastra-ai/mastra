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

export const deletePipelineInputSchema = z.object({
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
  pipeline_id: z.number().describe('The ID of the pipeline to delete. Example: 123'),
});

export const deletePipelineOutputSchema = z.object({
  success: z.boolean(),
  project_id: z.string(),
  pipeline_id: z.number(),
});

export function deletePipelineTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_delete_pipeline',
    description:
      'Delete a pipeline in GitLab. This permanently deletes the pipeline and all immediately related objects, such as builds, logs, artifacts, and triggers. This action cannot be undone.',
    inputSchema: deletePipelineInputSchema,
    outputSchema: deletePipelineOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deletePipelineOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const encodedProjectId = input.project_id;

      // https://docs.gitlab.com/api/pipelines/#delete-a-pipeline
      await platformProxy.delete({
        endpoint: `/api/v4/projects/${gitlabPathSegment(encodedProjectId)}/pipelines/${encodeURIComponent(String(input.pipeline_id))}`,
        retries: 1,
      });

      return {
        success: true,
        project_id: String(input.project_id),
        pipeline_id: input.pipeline_id,
      };
    },
  });
}
