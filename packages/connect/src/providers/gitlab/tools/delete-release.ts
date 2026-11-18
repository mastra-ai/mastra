// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

/** Encodes one GitLab path segment exactly once, whether `value` arrives raw or already URL-encoded. */
function gitlabPathSegment(value: string | number): string {
  const text = String(value);
  try {
    return encodeURIComponent(decodeURIComponent(text));
  } catch {
    return encodeURIComponent(text);
  }
}

export const deleteReleaseInputSchema = z.object({
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
});

const ProviderReleaseSchema = z.object({
  tag_name: z.string(),
  name: z.string().nullable().optional(),
  created_at: z.string().optional(),
  released_at: z.string().optional(),
});

export const deleteReleaseOutputSchema = z.object({
  tag_name: z.string(),
  name: z.string().optional(),
  deleted: z.literal(true),
});

export function deleteReleaseTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_delete_release',
    description: 'Delete a release in GitLab.',
    inputSchema: deleteReleaseInputSchema,
    outputSchema: deleteReleaseOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteReleaseOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://docs.gitlab.com/api/releases/#delete-a-release
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/releases/${encodeURIComponent(String(input.tag_name))}`,
        retries: 1,
      };

      const response = await platformProxy.delete(config);

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Release not found or could not be deleted',
          project_id: String(input.project_id),
          tag_name: input.tag_name,
        });
      }

      const providerRelease = ProviderReleaseSchema.parse(response.data);

      return {
        tag_name: providerRelease.tag_name,
        ...(providerRelease.name != null && { name: providerRelease.name }),
        deleted: true,
      };
    },
  });
}
