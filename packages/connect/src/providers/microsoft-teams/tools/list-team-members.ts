// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listTeamMembersInputSchema = z.object({
  teamId: z.string().describe('Team ID. Example: "ee0f5ae2-8bc6-4ae5-8466-7daeebbfa062"'),
  cursor: z
    .string()
    .optional()
    .describe('Full @odata.nextLink URL from the previous response. Omit for the first page.'),
});

const ProviderMemberSchema = z.object({
  id: z.string(),
  roles: z.array(z.string()).optional(),
  displayName: z.string().optional(),
  userId: z.string().optional(),
  email: z.string().optional(),
  tenantId: z.string().optional(),
});

const MemberSchema = z.object({
  id: z.string(),
  roles: z.array(z.string()).optional(),
  displayName: z.string().optional(),
  userId: z.string().optional(),
  email: z.string().optional(),
  tenantId: z.string().optional(),
});

export const listTeamMembersOutputSchema = z.object({
  items: z.array(MemberSchema),
  nextCursor: z.string().optional(),
});

const ProviderResponseSchema = z.object({
  value: z.array(ProviderMemberSchema),
  '@odata.nextLink': z.string().optional(),
});

export function listTeamMembersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_teams_list_team_members',
    description: 'List members in a team.',
    inputSchema: listTeamMembersInputSchema,
    outputSchema: listTeamMembersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listTeamMembersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://learn.microsoft.com/graph/api/team-list-members
        endpoint: input.cursor || `/v1.0/teams/${input.teamId}/members`,
        ...(input.cursor ? {} : { params: { $top: 50 } }),
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        items: providerResponse.value.map(member => ({
          id: member.id,
          ...(member.roles !== undefined && { roles: member.roles }),
          ...(member.displayName !== undefined && { displayName: member.displayName }),
          ...(member.userId !== undefined && { userId: member.userId }),
          ...(member.email !== undefined && { email: member.email }),
          ...(member.tenantId !== undefined && { tenantId: member.tenantId }),
        })),
        ...(providerResponse['@odata.nextLink'] !== undefined && { nextCursor: providerResponse['@odata.nextLink'] }),
      };
    },
  });
}
