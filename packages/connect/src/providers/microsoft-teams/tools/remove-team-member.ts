// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const removeTeamMemberInputSchema = z.object({
  teamId: z.string().describe('The unique identifier of the team. Example: "12345678-1234-1234-1234-123456789012"'),
  membershipId: z
    .string()
    .describe('The unique identifier of the team membership. Example: "12345678-1234-1234-1234-123456789012"'),
});

export const removeTeamMemberOutputSchema = z.object({
  success: z.boolean(),
  teamId: z.string(),
  membershipId: z.string(),
});

export function removeTeamMemberTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_teams_remove_team_member',
    description: 'Remove a member from a team.',
    inputSchema: removeTeamMemberInputSchema,
    outputSchema: removeTeamMemberOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof removeTeamMemberOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/conversationmember-delete
      await platformProxy.delete({
        endpoint: `/v1.0/teams/${input.teamId}/members/${input.membershipId}`,
        retries: 3,
      });

      return {
        success: true,
        teamId: input.teamId,
        membershipId: input.membershipId,
      };
    },
  });
}
