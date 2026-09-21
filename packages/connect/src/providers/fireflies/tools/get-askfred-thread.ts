// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getAskfredThreadInputSchema = z.object({
  id: z.string().describe('The unique identifier of the AskFred thread to retrieve. Example: "thread_abc123"'),
});

const AskFredMessageProviderSchema = z.object({
  id: z.string().nullable().optional(),
  thread_id: z.string().nullable().optional(),
  query: z.string().nullable().optional(),
  answer: z.string().nullable().optional(),
  suggested_queries: z.array(z.string()).nullable().optional(),
  status: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

const AskFredThreadProviderSchema = z.object({
  id: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  transcript_id: z.string().nullable().optional(),
  user_id: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  messages: z.array(AskFredMessageProviderSchema).nullable().optional(),
});

const AskFredMessageOutputSchema = z.object({
  id: z.string().optional(),
  thread_id: z.string().optional(),
  query: z.string().optional(),
  answer: z.string().optional(),
  suggested_queries: z.array(z.string()).optional(),
  status: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const getAskfredThreadOutputSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  transcript_id: z.string().optional(),
  user_id: z.string().optional(),
  created_at: z.string().optional(),
  messages: z.array(AskFredMessageOutputSchema).optional(),
});

function normalizeMessage(
  message: z.infer<typeof AskFredMessageProviderSchema>,
): z.infer<typeof AskFredMessageOutputSchema> {
  return {
    ...(message.id != null && { id: message.id }),
    ...(message.thread_id != null && { thread_id: message.thread_id }),
    ...(message.query != null && { query: message.query }),
    ...(message.answer != null && { answer: message.answer }),
    ...(message.suggested_queries != null && { suggested_queries: message.suggested_queries }),
    ...(message.status != null && { status: message.status }),
    ...(message.created_at != null && { created_at: message.created_at }),
    ...(message.updated_at != null && { updated_at: message.updated_at }),
  };
}

export function getAskfredThreadTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_get_askfred_thread',
    description: 'Retrieve an AskFred conversation thread with all messages.',
    inputSchema: getAskfredThreadInputSchema,
    outputSchema: getAskfredThreadOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getAskfredThreadOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const query = `
            query GetAskFredThread($id: String!) {
                askfred_thread(id: $id) {
                    id
                    title
                    transcript_id
                    user_id
                    created_at
                    messages {
                        id
                        thread_id
                        query
                        answer
                        suggested_queries
                        status
                        created_at
                        updated_at
                    }
                }
            }
        `;

      const response = await platformProxy.post({
        // https://docs.fireflies.ai/graphql-api/query/askfred-thread
        endpoint: '/graphql',
        data: {
          query: query,
          variables: {
            id: input.id,
          },
        },
        retries: 3,
      });

      if (response.data && response.data.errors && response.data.errors.length > 0) {
        const firstError = response.data.errors[0];
        throw new platformProxy.ActionError({
          type: firstError.extensions?.code || 'api_error',
          message: firstError.message || 'GraphQL error occurred',
        });
      }

      if (!response.data || !response.data.data || !response.data.data.askfred_thread) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `AskFred thread not found for id: ${input.id}`,
        });
      }

      const thread = AskFredThreadProviderSchema.parse(response.data.data.askfred_thread);

      return {
        ...(thread.id != null && { id: thread.id }),
        ...(thread.title != null && { title: thread.title }),
        ...(thread.transcript_id != null && { transcript_id: thread.transcript_id }),
        ...(thread.user_id != null && { user_id: thread.user_id }),
        ...(thread.created_at != null && { created_at: thread.created_at }),
        ...(thread.messages != null && { messages: thread.messages.map(normalizeMessage) }),
      };
    },
  });
}
