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

export const updateGroupInputSchema = z
  .object({
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
      .describe('The ID of the group. Example: 133159324'),
    name: z.string().optional().describe('The name of the group'),
    path: z.string().optional().describe('The path of the group'),
    description: z.string().nullable().optional().describe('The description of the group'),
    visibility: z.enum(['private', 'internal', 'public']).optional().describe('The visibility level of the group'),
    request_access_enabled: z.boolean().optional().describe('Allow users to request member access'),
    lfs_enabled: z
      .boolean()
      .optional()
      .describe('Enable/disable Large File Storage (LFS) for the projects in this group'),
    project_creation_level: z.string().optional().describe('Determine if developers can create projects in the group'),
    subgroup_creation_level: z.string().optional().describe('Allowed to create subgroups'),
    default_branch: z.string().optional().describe("The default branch name for group's projects"),
    emails_enabled: z.boolean().optional().describe('Enable email notifications'),
    mentions_disabled: z.boolean().optional().describe('Disable the capability of a group from getting mentioned'),
    share_with_group_lock: z
      .boolean()
      .optional()
      .describe('Prevent sharing a project with another group within this group'),
    require_two_factor_authentication: z
      .boolean()
      .optional()
      .describe('Require all users in this group to set up two-factor authentication'),
    two_factor_grace_period: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('Time before Two-factor authentication is enforced (in hours)'),
    auto_devops_enabled: z
      .boolean()
      .optional()
      .describe('Default to Auto DevOps pipeline for all projects within this group'),
  })
  .refine(data => Object.entries(data).some(([key, value]) => !['id'].includes(key) && value !== undefined), {
    message: 'Provide at least one field to update.',
  });

const ProviderGroupSchema = z.object({
  id: z.number(),
  name: z.string(),
  path: z.string(),
  description: z.string().nullable(),
  visibility: z.string(),
  avatar_url: z.string().nullable(),
  web_url: z.string(),
  request_access_enabled: z.boolean(),
  full_name: z.string(),
  full_path: z.string(),
  parent_id: z.number().nullable(),
  created_at: z.string(),
});

export const updateGroupOutputSchema = z.object({
  id: z.number(),
  name: z.string(),
  path: z.string(),
  description: z.string().optional(),
  visibility: z.string(),
  avatar_url: z.string().optional(),
  web_url: z.string(),
  request_access_enabled: z.boolean(),
  full_name: z.string(),
  full_path: z.string(),
  parent_id: z.number().optional(),
  created_at: z.string(),
});

export function updateGroupTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_update_group',
    description: 'Update a group in GitLab',
    inputSchema: updateGroupInputSchema,
    outputSchema: updateGroupOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateGroupOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const groupId = String(input.id);
      const data: Record<string, unknown> = {};

      if (input.name !== undefined) {
        data['name'] = input.name;
      }
      if (input.path !== undefined) {
        data['path'] = input.path;
      }
      if (input.description !== undefined) {
        data['description'] = input.description;
      }
      if (input.visibility !== undefined) {
        data['visibility'] = input.visibility;
      }
      if (input.request_access_enabled !== undefined) {
        data['request_access_enabled'] = input.request_access_enabled;
      }
      if (input.lfs_enabled !== undefined) {
        data['lfs_enabled'] = input.lfs_enabled;
      }
      if (input.project_creation_level !== undefined) {
        data['project_creation_level'] = input.project_creation_level;
      }
      if (input.subgroup_creation_level !== undefined) {
        data['subgroup_creation_level'] = input.subgroup_creation_level;
      }
      if (input.default_branch !== undefined) {
        data['default_branch'] = input.default_branch;
      }
      if (input.emails_enabled !== undefined) {
        data['emails_enabled'] = input.emails_enabled;
      }
      if (input.mentions_disabled !== undefined) {
        data['mentions_disabled'] = input.mentions_disabled;
      }
      if (input.share_with_group_lock !== undefined) {
        data['share_with_group_lock'] = input.share_with_group_lock;
      }
      if (input.require_two_factor_authentication !== undefined) {
        data['require_two_factor_authentication'] = input.require_two_factor_authentication;
      }
      if (input.two_factor_grace_period !== undefined) {
        data['two_factor_grace_period'] = input.two_factor_grace_period;
      }
      if (input.auto_devops_enabled !== undefined) {
        data['auto_devops_enabled'] = input.auto_devops_enabled;
      }

      const config: PlatformProxyRequest = {
        // https://docs.gitlab.com/api/groups/#update-group
        endpoint: `/api/v4/groups/${gitlabPathSegment(groupId)}`,
        data,
        retries: 1,
      };
      const response = await platformProxy.put(config);

      const providerGroup = ProviderGroupSchema.parse(response.data);

      return {
        id: providerGroup.id,
        name: providerGroup.name,
        path: providerGroup.path,
        ...(providerGroup.description != null && { description: providerGroup.description }),
        visibility: providerGroup.visibility,
        ...(providerGroup.avatar_url != null && { avatar_url: providerGroup.avatar_url }),
        web_url: providerGroup.web_url,
        request_access_enabled: providerGroup.request_access_enabled,
        full_name: providerGroup.full_name,
        full_path: providerGroup.full_path,
        ...(providerGroup.parent_id != null && { parent_id: providerGroup.parent_id }),
        created_at: providerGroup.created_at,
      };
    },
  });
}
