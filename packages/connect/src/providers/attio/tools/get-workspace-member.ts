// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getWorkspaceMemberInputSchema = z.object({
  workspace_member_id: z
    .string()
    .describe('The ID of the workspace member to retrieve. Example: "641ecd33-0a48-4b7b-ba48-bbb7a649a8ee"'),
});

const WorkspaceMemberIdSchema = z.object({
  workspace_id: z.string(),
  workspace_member_id: z.string(),
});

const ProviderWorkspaceMemberSchema = z.object({
  id: WorkspaceMemberIdSchema,
  first_name: z.string(),
  last_name: z.string(),
  avatar_url: z.string().nullable(),
  email_address: z.string(),
  created_at: z.string(),
  access_level: z.enum(['admin', 'member', 'suspended']).or(z.string()),
});

export const getWorkspaceMemberOutputSchema = z.object({
  id: WorkspaceMemberIdSchema,
  first_name: z.string(),
  last_name: z.string(),
  avatar_url: z.string().optional(),
  email_address: z.string(),
  created_at: z.string(),
  access_level: z.enum(['admin', 'member', 'suspended']).or(z.string()),
});

export function getWorkspaceMemberTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_get_workspace_member',
    description: 'Retrieve a single workspace member from Attio.',
    inputSchema: getWorkspaceMemberInputSchema,
    outputSchema: getWorkspaceMemberOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getWorkspaceMemberOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.attio.com/rest-api/endpoint-reference/workspace-members/get-a-workspace-member
      const response = await platformProxy.get({
        endpoint: `/v2/workspace_members/${input.workspace_member_id}`,
        retries: 3,
      });

      if (!response.data?.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Workspace member with ID "${input.workspace_member_id}" not found.`,
          workspace_member_id: input.workspace_member_id,
        });
      }

      const member = ProviderWorkspaceMemberSchema.parse(response.data.data);

      return {
        id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        ...(member.avatar_url !== null && { avatar_url: member.avatar_url }),
        email_address: member.email_address,
        created_at: member.created_at,
        access_level: member.access_level,
      };
    },
  });
}
