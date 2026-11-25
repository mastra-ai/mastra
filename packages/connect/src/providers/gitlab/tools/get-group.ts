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

export const getGroupInputSchema = z.object({
  id: z
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
    .describe('The ID or URL-encoded path of the group. Example: "133159324"'),
});

const ProviderGroupSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    path: z.string(),
    description: z.string().nullable().optional(),
    visibility: z.string().optional(),
    avatar_url: z.string().nullable().optional(),
    web_url: z.string().optional(),
    request_access_enabled: z.boolean().optional(),
    repository_storage: z.string().optional(),
    full_name: z.string().optional(),
    full_path: z.string().optional(),
    file_template_project_id: z.number().nullable().optional(),
    parent_id: z.number().nullable().optional(),
    created_at: z.string().optional(),
  })
  .passthrough();

export const getGroupOutputSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    path: z.string(),
    description: z.string().optional(),
    visibility: z.string().optional(),
    avatar_url: z.string().optional(),
    web_url: z.string().optional(),
    request_access_enabled: z.boolean().optional(),
    repository_storage: z.string().optional(),
    full_name: z.string().optional(),
    full_path: z.string().optional(),
    file_template_project_id: z.number().optional(),
    parent_id: z.number().optional(),
    created_at: z.string().optional(),
  })
  .passthrough();

export function getGroupTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_get_group',
    description: 'Retrieve a single group from GitLab.',
    inputSchema: getGroupInputSchema,
    outputSchema: getGroupOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getGroupOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.gitlab.com/api/groups/#get-a-single-group
        endpoint: `/api/v4/groups/${gitlabPathSegment(input.id)}`,
        params: { with_projects: false },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Group not found',
          id: input.id,
        });
      }

      const providerGroup = ProviderGroupSchema.parse(response.data);

      return {
        id: providerGroup.id,
        name: providerGroup.name,
        path: providerGroup.path,
        ...(providerGroup.description != null && { description: providerGroup.description }),
        ...(providerGroup.visibility !== undefined && { visibility: providerGroup.visibility }),
        ...(providerGroup.avatar_url != null && { avatar_url: providerGroup.avatar_url }),
        ...(providerGroup.web_url !== undefined && { web_url: providerGroup.web_url }),
        ...(providerGroup.request_access_enabled !== undefined && {
          request_access_enabled: providerGroup.request_access_enabled,
        }),
        ...(providerGroup.repository_storage !== undefined && { repository_storage: providerGroup.repository_storage }),
        ...(providerGroup.full_name !== undefined && { full_name: providerGroup.full_name }),
        ...(providerGroup.full_path !== undefined && { full_path: providerGroup.full_path }),
        ...(providerGroup.file_template_project_id != null && {
          file_template_project_id: providerGroup.file_template_project_id,
        }),
        ...(providerGroup.parent_id != null && { parent_id: providerGroup.parent_id }),
        ...(providerGroup.created_at !== undefined && { created_at: providerGroup.created_at }),
      };
    },
  });
}
