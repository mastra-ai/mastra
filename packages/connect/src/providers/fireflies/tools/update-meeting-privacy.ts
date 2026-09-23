// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const PrivacyEnum = z.enum([
  'link',
  'owner',
  'participants',
  'participatingteammates',
  'teammatesandparticipants',
  'teammates',
]);

const PrivacyEnumWidened = z
  .enum(['link', 'owner', 'participants', 'participatingteammates', 'teammatesandparticipants', 'teammates'])
  .or(z.string());

export const updateMeetingPrivacyInputSchema = z.object({
  id: z.string().describe('Transcript ID. Example: "abc123"'),
  privacy: PrivacyEnum.describe('Privacy setting. Example: "teammates"'),
});

export const updateMeetingPrivacyOutputSchema = z.boolean();

const GraphQLResponseSchema = z.object({
  data: z
    .object({
      updateMeetingPrivacy: z.object({
        id: z.string(),
        privacy: PrivacyEnumWidened,
      }),
    })
    .nullable()
    .optional(),
  errors: z.array(z.unknown()).optional(),
});

export function updateMeetingPrivacyTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_update_meeting_privacy',
    description: 'Update the privacy setting of a meeting transcript.',
    inputSchema: updateMeetingPrivacyInputSchema,
    outputSchema: updateMeetingPrivacyOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateMeetingPrivacyOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.fireflies.ai/graphql-api/query/transcript
        endpoint: '/graphql',
        data: {
          query: `
                    mutation UpdateMeetingPrivacy($input: UpdateMeetingPrivacyInput!) {
                        updateMeetingPrivacy(input: $input) {
                            id
                            privacy
                        }
                    }
                `,
          variables: {
            input: {
              id: input.id,
              privacy: input.privacy,
            },
          },
        },
        retries: 10,
      });

      const parsed = GraphQLResponseSchema.parse(response.data);

      if (parsed.errors && parsed.errors.length > 0) {
        throw new platformProxy.ActionError({
          type: 'graphql_error',
          message: 'GraphQL errors occurred during updateMeetingPrivacy.',
          errors: parsed.errors,
        });
      }

      if (!parsed.data?.updateMeetingPrivacy) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Missing updateMeetingPrivacy in response.',
        });
      }

      return true;
    },
  });
}
