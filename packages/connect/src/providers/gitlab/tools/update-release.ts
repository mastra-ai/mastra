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

export const updateReleaseInputSchema = z
  .object({
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
    tag_name: z.string().describe('The Git tag the release is associated with. Example: "v1.0.0"'),
    name: z.string().optional().describe('The release name.'),
    description: z.string().optional().describe('The description of the release. You can use Markdown.'),
    milestones: z
      .array(z.string())
      .optional()
      .describe('The title of each milestone to associate with the release. To remove all milestones, specify [].'),
    released_at: z
      .string()
      .optional()
      .describe('The date when the release is/was ready. Expected in ISO 8601 format (e.g. 2019-03-15T08:00:00Z).'),
  })
  .refine(
    data =>
      Object.entries(data).some(([key, value]) => !['project_id', 'tag_name'].includes(key) && value !== undefined),
    { message: 'Provide at least one field to update.' },
  );

const ProviderReleaseSchema = z
  .object({
    tag_name: z.string(),
    name: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    created_at: z.string(),
    released_at: z.string(),
  })
  .passthrough();

export const updateReleaseOutputSchema = z.object({
  tag_name: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  created_at: z.string(),
  released_at: z.string(),
});

export function updateReleaseTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_update_release',
    description: 'Update a release in GitLab.',
    inputSchema: updateReleaseInputSchema,
    outputSchema: updateReleaseOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateReleaseOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.gitlab.com/api/releases/#update-a-release
      const response = await platformProxy.put({
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/releases/${encodeURIComponent(String(input.tag_name))}`,
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.milestones !== undefined && { milestones: input.milestones }),
          ...(input.released_at !== undefined && { released_at: input.released_at }),
        },
        retries: 1,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Release not found or update failed.',
          project_id: String(input.project_id),
          tag_name: input.tag_name,
        });
      }

      const providerRelease = ProviderReleaseSchema.parse(response.data);

      return {
        tag_name: providerRelease.tag_name,
        created_at: providerRelease.created_at,
        released_at: providerRelease.released_at,
        ...(providerRelease.name != null && { name: providerRelease.name }),
        ...(providerRelease.description != null && { description: providerRelease.description }),
      };
    },
  });
}
