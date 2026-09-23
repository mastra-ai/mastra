// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const continueAskfredThreadInputSchema = z.object({
  thread_id: z.string().describe('The ID of the existing AskFred thread to continue. Example: "thread_abc123"'),
  query: z.string().max(2000).describe('Follow-up question or query. Maximum 2000 characters.'),
  format_mode: z.enum(['markdown', 'plaintext']).optional().describe('Response format: markdown or plaintext'),
  response_language: z.string().optional().describe('Language code for the response (e.g., "en" for English).'),
});

const AskFredMessageSchema = z.object({
  id: z.string(),
  thread_id: z.string(),
  query: z.string(),
  answer: z.string(),
  suggested_queries: z.array(z.string()).optional(),
  status: z.string(),
  created_at: z.string().optional(),
});

export const continueAskfredThreadOutputSchema = z.object({
  message: AskFredMessageSchema,
});

const GraphQLResponseSchema = z.object({
  data: z.object({
    continueAskFredThread: z.object({
      message: AskFredMessageSchema,
    }),
  }),
});

export function continueAskfredThreadTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_continue_askfred_thread',
    description: 'Continue an existing AskFred conversation thread.',
    inputSchema: continueAskfredThreadInputSchema,
    outputSchema: continueAskfredThreadOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof continueAskfredThreadOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.fireflies.ai/graphql-api/mutation/continue-askfred-thread
        endpoint: '/graphql',
        data: {
          query: `
                    mutation ContinueAskFredThread($input: ContinueAskFredThreadInput!) {
                        continueAskFredThread(input: $input) {
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
                `,
          variables: {
            input: {
              thread_id: input.thread_id,
              query: input.query,
              ...(input.format_mode !== undefined && { format_mode: input.format_mode }),
              ...(input.response_language !== undefined && { response_language: input.response_language }),
            },
          },
        },
        retries: 3,
      });

      const responseBody = z
        .object({
          data: z.unknown().optional(),
          errors: z.array(z.object({ message: z.string() })).optional(),
        })
        .parse(response.data);

      if (responseBody.errors && responseBody.errors.length > 0) {
        throw new platformProxy.ActionError({
          type: 'graphql_error',
          message: responseBody.errors[0]!.message,
        });
      }

      const parsed = GraphQLResponseSchema.parse(response.data);

      return {
        message: parsed.data.continueAskFredThread.message,
      };
    },
  });
}
