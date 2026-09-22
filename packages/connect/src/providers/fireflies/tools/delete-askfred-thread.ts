// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteAskfredThreadInputSchema = z.object({
  id: z.string().describe('The unique identifier of the AskFred thread to delete. Example: "thread_abc123"'),
});

const ProviderOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  transcript_id: z.string().nullable().optional(),
  user_id: z.string(),
  created_at: z.string(),
});

export const deleteAskfredThreadOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  transcript_id: z.string().optional(),
  user_id: z.string(),
  created_at: z.string(),
});

export function deleteAskfredThreadTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_delete_askfred_thread',
    description: 'Delete an AskFred conversation thread and all its messages.',
    inputSchema: deleteAskfredThreadInputSchema,
    outputSchema: deleteAskfredThreadOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteAskfredThreadOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.fireflies.ai/graphql-api/mutation/delete-askfred-thread
        endpoint: '/graphql',
        data: {
          query: `mutation DeleteAskFredThread($id: String!) {
                    deleteAskFredThread(id: $id) {
                        id
                        title
                        transcript_id
                        user_id
                        created_at
                    }
                }`,
          variables: {
            id: input.id,
          },
        },
        retries: 3,
      });

      if (response.data && response.data.errors && response.data.errors.length > 0) {
        throw new platformProxy.ActionError({
          type: 'graphql_error',
          message: 'Failed to delete AskFred thread',
          errors: response.data.errors,
        });
      }

      const rawData = response.data?.data?.deleteAskFredThread;
      if (!rawData) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Thread not found or deletion failed',
          id: input.id,
        });
      }

      const providerOutput = ProviderOutputSchema.parse(rawData);

      return {
        id: providerOutput.id,
        title: providerOutput.title,
        ...(providerOutput.transcript_id != null && { transcript_id: providerOutput.transcript_id }),
        user_id: providerOutput.user_id,
        created_at: providerOutput.created_at,
      };
    },
  });
}
