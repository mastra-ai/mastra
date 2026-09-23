// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const shareMeetingInputSchema = z.object({
  meeting_id: z.string().describe('Meeting ID to share. Example: "abc123"'),
  emails: z.array(z.string().email()).max(50).describe('Email addresses to share with. Up to 50 emails per request.'),
  expiry_days: z
    .union([z.literal(7), z.literal(14), z.literal(30)])
    .optional()
    .describe('Optional expiry period in days. Allowed values: 7, 14, or 30.'),
});

export const shareMeetingOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

const ShareMeetingResultSchema = z.object({
  success: z.boolean(),
  message: z.string().nullable().optional(),
});

const FirefliesResponseSchema = z.object({
  data: z
    .union([
      z.object({
        shareMeeting: ShareMeetingResultSchema.optional(),
      }),
      z.null(),
    ])
    .optional(),
  errors: z
    .array(
      z.object({
        message: z.string(),
        code: z.string().optional(),
      }),
    )
    .optional(),
});

export function shareMeetingTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_share_meeting',
    description: 'Share a meeting transcript via email with optional expiry',
    inputSchema: shareMeetingInputSchema,
    outputSchema: shareMeetingOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof shareMeetingOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.fireflies.ai/graphql-api/mutation/share-meeting
      const response = await platformProxy.post({
        endpoint: '/graphql',
        data: {
          query: `
                    mutation ShareMeeting($input: ShareMeetingInput!) {
                        shareMeeting(input: $input) {
                            success
                            message
                        }
                    }
                `,
          variables: {
            input: {
              meeting_id: input.meeting_id,
              emails: input.emails,
              ...(input.expiry_days !== undefined && { expiry_days: input.expiry_days }),
            },
          },
        },
        retries: 10,
      });

      const responseData = response.data;

      if (responseData === null || typeof responseData !== 'object') {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Fireflies API',
        });
      }

      const parsedResponse = FirefliesResponseSchema.safeParse(responseData);
      if (!parsedResponse.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response format from Fireflies API',
          details: parsedResponse.error.format(),
        });
      }

      const graphqlErrors = parsedResponse.data.errors;
      if (graphqlErrors && graphqlErrors.length > 0) {
        const firstError = graphqlErrors[0];
        if (firstError) {
          throw new platformProxy.ActionError({
            type: firstError.code || 'graphql_error',
            message: firstError.message,
          });
        }
      }

      const shareMeetingResult = parsedResponse.data.data?.shareMeeting;
      if (!shareMeetingResult) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Missing shareMeeting data in response',
        });
      }

      return {
        success: shareMeetingResult.success,
        ...(shareMeetingResult.message != null && { message: shareMeetingResult.message }),
      };
    },
  });
}
