// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateMeetingStateInputSchema = z.object({
  meeting_id: z.string().describe('Meeting ID. Example: "abc123"'),
  action: z.enum(['pause_recording', 'resume_recording']).describe('Action to perform. Example: "pause_recording"'),
});

export const updateMeetingStateOutputSchema = z.object({
  success: z.boolean(),
  action: z.string(),
});

const ProviderResponseSchema = z.object({
  data: z
    .object({
      updateMeetingState: z
        .object({
          success: z.boolean(),
          action: z.string(),
        })
        .optional(),
    })
    .optional(),
  errors: z
    .array(
      z.object({
        message: z.string(),
        code: z.string().optional(),
        friendly: z.boolean().optional(),
      }),
    )
    .optional(),
});

export function updateMeetingStateTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_update_meeting_state',
    description: 'Pause or resume a live meeting recording.',
    inputSchema: updateMeetingStateInputSchema,
    outputSchema: updateMeetingStateOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateMeetingStateOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.fireflies.ai/graphql-api/mutation/update-meeting-state
        endpoint: '/graphql',
        data: {
          query:
            'mutation UpdateMeetingState($input: UpdateMeetingStateInput!) { updateMeetingState(input: $input) { success action } }',
          variables: {
            input: {
              meeting_id: input.meeting_id,
              action: input.action,
            },
          },
        },
        retries: 1,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      if (providerResponse.errors && providerResponse.errors.length > 0) {
        const firstError = providerResponse.errors[0];
        if (firstError) {
          throw new platformProxy.ActionError({
            type: firstError.code ?? 'graphql_error',
            message: firstError.message,
          });
        }
      }

      if (!providerResponse.data?.updateMeetingState) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Fireflies API: missing updateMeetingState data.',
        });
      }

      return {
        success: providerResponse.data.updateMeetingState.success,
        action: providerResponse.data.updateMeetingState.action,
      };
    },
  });
}
