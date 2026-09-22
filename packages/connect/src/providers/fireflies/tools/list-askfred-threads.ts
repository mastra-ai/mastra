// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listAskfredThreadsInputSchema = z.object({
  transcript_id: z
    .string()
    .optional()
    .describe('Filter threads to only those associated with a specific transcript ID. Example: "transcript_xyz789"'),
});

const AskFredThreadSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  created_at: z.string().optional(),
  transcript_id: z.string().optional().nullable(),
  user_id: z.string().optional(),
});

export const listAskfredThreadsOutputSchema = z.array(AskFredThreadSummarySchema);

export function listAskfredThreadsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_list_askfred_threads',
    description: 'List AskFred AI conversation threads, optionally filtered by transcript.',
    inputSchema: listAskfredThreadsInputSchema,
    outputSchema: listAskfredThreadsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listAskfredThreadsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.fireflies.ai/graphql-api/query/askfred-threads
        endpoint: '/graphql',
        data: {
          query: `
                    query GetAskFredThreads($transcriptId: String) {
                        askfred_threads(transcript_id: $transcriptId) {
                            id
                            title
                            transcript_id
                            user_id
                            created_at
                        }
                    }
                `,
          variables: {
            ...(input.transcript_id !== undefined && { transcriptId: input.transcript_id }),
          },
        },
        retries: 3,
      });

      const threadsData = response.data?.data?.askfred_threads;
      if (!Array.isArray(threadsData)) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response format from Fireflies API',
        });
      }

      return threadsData.map((thread: unknown) => {
        const parsed = AskFredThreadSummarySchema.parse(thread);
        return {
          id: parsed.id,
          title: parsed.title,
          created_at: parsed.created_at,
          transcript_id: parsed.transcript_id,
          user_id: parsed.user_id,
        };
      });
    },
  });
}
