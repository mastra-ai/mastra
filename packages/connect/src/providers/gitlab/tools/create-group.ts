// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createGroupInputSchema = z.object({
  name: z.string().describe('The name of the group. Example: "My Group"'),
  path: z.string().describe('The path of the group. Example: "my-group"'),
  parent_id: z.number().optional().describe('The parent group ID for creating a nested group. Example: 133159324'),
  description: z.string().optional().describe('The group description.'),
  visibility: z.enum(['private', 'internal', 'public']).optional().describe('The group visibility level.'),
  lfs_enabled: z.boolean().optional().describe('Enable/disable Large File Storage (LFS) for projects in this group.'),
  request_access_enabled: z.boolean().optional().describe('Allow users to request member access.'),
});

const ProviderGroupSchema = z.object({
  id: z.number(),
  name: z.string(),
  path: z.string(),
  full_path: z.string(),
  description: z.string().nullable().optional(),
  visibility: z.string(),
  web_url: z.string(),
  parent_id: z.number().nullable().optional(),
});

export const createGroupOutputSchema = z.object({
  id: z.number(),
  name: z.string(),
  path: z.string(),
  full_path: z.string(),
  description: z.string().optional(),
  visibility: z.string(),
  web_url: z.string(),
  parent_id: z.number().optional(),
});

export function createGroupTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_create_group',
    description: 'Create a group in GitLab.',
    inputSchema: createGroupInputSchema,
    outputSchema: createGroupOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createGroupOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const data: Record<string, unknown> = {
        name: input.name,
        path: input.path,
        ...(input.parent_id !== undefined && { parent_id: input.parent_id }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.visibility !== undefined && { visibility: input.visibility }),
        ...(input.lfs_enabled !== undefined && { lfs_enabled: input.lfs_enabled }),
        ...(input.request_access_enabled !== undefined && { request_access_enabled: input.request_access_enabled }),
      };

      // https://docs.gitlab.com/api/groups/#create-a-group
      const response = await platformProxy.post({
        endpoint: '/api/v4/groups',
        data,
        retries: 1,
      });

      const providerGroup = ProviderGroupSchema.parse(response.data);

      return {
        id: providerGroup.id,
        name: providerGroup.name,
        path: providerGroup.path,
        full_path: providerGroup.full_path,
        ...(providerGroup.description != null && { description: providerGroup.description }),
        visibility: providerGroup.visibility,
        web_url: providerGroup.web_url,
        ...(providerGroup.parent_id != null && { parent_id: providerGroup.parent_id }),
      };
    },
  });
}
