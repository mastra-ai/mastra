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

export const deleteProjectInputSchema = z.object({
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
  archive: z
    .boolean()
    .optional()
    .describe(
      'If true, archive the project instead of deleting it. Defaults to false, which requests deletion; GitLab.com and instances with delayed deletion keep the project for a retention period before removing it.',
    ),
});

const ArchiveProjectResponseSchema = z.object({
  id: z.number(),
  archived: z.boolean().optional(),
  name: z.string().optional(),
});

export const deleteProjectOutputSchema = z.object({
  success: z.boolean(),
  project_id: z.string(),
  archived: z
    .boolean()
    .describe(
      'true when this call archived the project, false when it requested deletion. Not the project archive state.',
    ),
  message: z.string().optional(),
});

export function deleteProjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_delete_project',
    description: 'Delete or archive a project in GitLab.',
    inputSchema: deleteProjectInputSchema,
    outputSchema: deleteProjectOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteProjectOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const encodedProjectId = input.project_id;

      if (input.archive) {
        // https://docs.gitlab.com/api/projects/#archive-a-project
        const response = await platformProxy.post({
          endpoint: `/api/v4/projects/${gitlabPathSegment(encodedProjectId)}/archive`,
          retries: 1,
        });

        const providerProject = ArchiveProjectResponseSchema.parse(response.data);

        return {
          success: true,
          project_id: String(providerProject.id),
          archived: providerProject.archived ?? true,
          message: 'Project archived successfully.',
        };
      }

      // https://docs.gitlab.com/api/projects/#delete-project
      await platformProxy.delete({
        endpoint: `/api/v4/projects/${gitlabPathSegment(encodedProjectId)}`,
        retries: 1,
      });

      return {
        success: true,
        project_id: String(input.project_id),
        archived: false,
        message:
          'GitLab accepted the deletion request. GitLab.com and instances with delayed deletion keep the project for a retention period before removing it.',
      };
    },
  });
}
