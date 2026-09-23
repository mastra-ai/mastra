// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const revokeSharedMeetingAccessInputSchema = z.object({
  meeting_id: z.string().describe('The unique identifier of the meeting / transcript.'),
  email: z.string().describe('The email address of the user whose shared access should be revoked.'),
});

const ProviderResponseSchema = z.object({
  data: z.object({
    revokeSharedMeetingAccess: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
  }),
});

export const revokeSharedMeetingAccessOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export function revokeSharedMeetingAccessTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_revoke_shared_meeting_access',
    description: 'Revoke a previously shared meeting access.',
    inputSchema: revokeSharedMeetingAccessInputSchema,
    outputSchema: revokeSharedMeetingAccessOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof revokeSharedMeetingAccessOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.fireflies.ai/graphql-api/mutation/revoke-shared-meeting-access
      const response = await platformProxy.post({
        endpoint: '/graphql',
        data: {
          query: `mutation($input: RevokeSharedMeetingAccessInput!) { revokeSharedMeetingAccess(input: $input) { success message } }`,
          variables: {
            input: {
              meeting_id: input.meeting_id,
              email: input.email,
            },
          },
        },
        retries: 10,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        success: providerResponse.data.revokeSharedMeetingAccess.success,
        message: providerResponse.data.revokeSharedMeetingAccess.message,
      };
    },
  });
}
