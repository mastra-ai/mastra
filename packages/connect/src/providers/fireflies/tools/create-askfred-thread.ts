// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const AskFredMeetingFiltersInputSchema = z.object({
  start_time: z.string().optional().describe('ISO 8601 datetime. Example: "2024-03-01T00:00:00Z"'),
  end_time: z.string().optional().describe('ISO 8601 datetime. Example: "2024-03-31T23:59:59Z"'),
  channel_ids: z.array(z.string()).optional().describe('Channel/integration IDs to filter by'),
  organizers: z.array(z.string()).optional().describe('Organizer email addresses to filter by'),
  participants: z.array(z.string()).optional().describe('Participant email addresses to filter by'),
  transcript_ids: z.array(z.string()).optional().describe('Specific transcript IDs to filter by'),
});

export const createAskfredThreadInputSchema = z.object({
  query: z
    .string()
    .max(2000)
    .describe(
      'Question or query about the meeting(s). Maximum 2000 characters. Example: "What were the main action items?"',
    ),
  transcript_id: z.string().optional().describe('Specific transcript ID to query. If provided, filters are ignored.'),
  filters: AskFredMeetingFiltersInputSchema.optional().describe(
    'Filters to search across multiple meetings. Only used when transcript_id is not provided.',
  ),
  response_language: z.string().optional().describe('Language code for the response (e.g., "en", "es").'),
  format_mode: z.string().optional().describe('Response format: "markdown" or "plaintext".'),
});

const AskFredMessageSchema = z.object({
  id: z.string(),
  thread_id: z.string(),
  query: z.string().optional(),
  answer: z.string().optional(),
  suggested_queries: z.array(z.string()).optional(),
  status: z.string().optional(),
  created_at: z.string().optional(),
});

const ProviderResponseSchema = z.object({
  data: z
    .object({
      createAskFredThread: z
        .object({
          message: AskFredMessageSchema,
        })
        .optional(),
    })
    .nullable()
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

export const createAskfredThreadOutputSchema = z.object({
  id: z.string(),
  thread_id: z.string(),
  query: z.string().optional(),
  answer: z.string().optional(),
  suggested_queries: z.array(z.string()).optional(),
  status: z.string().optional(),
  created_at: z.string().optional(),
});

export function createAskfredThreadTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_create_askfred_thread',
    description: 'Start a new AskFred AI conversation thread',
    inputSchema: createAskfredThreadInputSchema,
    outputSchema: createAskfredThreadOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createAskfredThreadOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const graphqlQuery = `
            mutation CreateAskFredThread($input: CreateAskFredThreadInput!) {
                createAskFredThread(input: $input) {
                    message {
                        id
                        thread_id
                        query
                        answer
                        suggested_queries
                        status
                        created_at
                    }
                }
            }
        `;

      const variables: Record<string, unknown> = {
        query: input.query,
      };

      if (input.transcript_id !== undefined) {
        variables['transcript_id'] = input.transcript_id;
      } else if (input.filters !== undefined) {
        variables['filters'] = input.filters;
      }

      if (input.response_language !== undefined) {
        variables['response_language'] = input.response_language;
      }

      if (input.format_mode !== undefined) {
        variables['format_mode'] = input.format_mode;
      }

      // https://docs.fireflies.ai/graphql-api/mutation/create-askfred-thread
      const response = await platformProxy.post({
        endpoint: 'graphql',
        data: {
          query: graphqlQuery,
          variables: { input: variables },
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      if (providerResponse.errors && providerResponse.errors.length > 0) {
        const firstError = providerResponse.errors[0];
        if (!firstError) {
          throw new platformProxy.ActionError({
            type: 'graphql_error',
            message: 'Unknown GraphQL error',
          });
        }
        throw new platformProxy.ActionError({
          type: firstError.code || 'graphql_error',
          message: firstError.message,
        });
      }

      const message = providerResponse.data?.createAskFredThread?.message;
      if (!message) {
        throw new platformProxy.ActionError({
          type: 'missing_response',
          message: 'No message returned from createAskFredThread',
        });
      }

      return {
        id: message.id,
        thread_id: message.thread_id,
        ...(message.query !== undefined && { query: message.query }),
        ...(message.answer !== undefined && { answer: message.answer }),
        ...(message.suggested_queries !== undefined && { suggested_queries: message.suggested_queries }),
        ...(message.status !== undefined && { status: message.status }),
        ...(message.created_at !== undefined && { created_at: message.created_at }),
      };
    },
  });
}
