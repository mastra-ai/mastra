// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listWorkspaceMembersInputSchema = z.object({});

const ProviderWorkspaceMemberIdSchema = z.object({
  workspace_id: z.string(),
  workspace_member_id: z.string(),
});

const ProviderWorkspaceMemberSchema = z.object({
  id: ProviderWorkspaceMemberIdSchema,
  first_name: z.string(),
  last_name: z.string(),
  avatar_url: z.string().nullable(),
  email_address: z.string(),
  created_at: z.string(),
  access_level: z.enum(['admin', 'member', 'suspended']).or(z.string()),
});

const ProviderResponseSchema = z.object({
  data: z.array(ProviderWorkspaceMemberSchema),
});

const WorkspaceMemberSchema = z.object({
  workspace_member_id: z.string(),
  workspace_id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  avatar_url: z.string().optional(),
  email_address: z.string(),
  created_at: z.string(),
  access_level: z.string(),
});

export const listWorkspaceMembersOutputSchema = z.object({
  items: z.array(WorkspaceMemberSchema),
});

export function listWorkspaceMembersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_list_workspace_members',
    description: 'List all workspace members in Attio.',
    inputSchema: listWorkspaceMembersInputSchema,
    outputSchema: listWorkspaceMembersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listWorkspaceMembersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.attio.com/rest-api/endpoint-reference/workspace-members
        endpoint: '/v2/workspace_members',
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      const items = providerResponse.data.map(member => ({
        workspace_member_id: member.id.workspace_member_id,
        workspace_id: member.id.workspace_id,
        first_name: member.first_name,
        last_name: member.last_name,
        ...(member.avatar_url != null && { avatar_url: member.avatar_url }),
        email_address: member.email_address,
        created_at: member.created_at,
        access_level: member.access_level,
      }));

      return {
        items,
      };
    },
  });
}
