// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteTranscriptInputSchema = z.object({
  id: z.string().describe('Transcript ID to delete. Example: "abc123"'),
});

export const deleteTranscriptOutputSchema = z.object({
  deleted: z.boolean(),
});

const GraphQLErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
});

const ProviderResponseSchema = z.object({
  data: z
    .object({
      deleteTranscript: z
        .object({
          id: z.string(),
        })
        .optional(),
    })
    .nullable()
    .optional(),
  errors: z.array(GraphQLErrorSchema).optional(),
});

export function deleteTranscriptTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_delete_transcript',
    description: 'Permanently delete a transcript by ID.',
    inputSchema: deleteTranscriptInputSchema,
    outputSchema: deleteTranscriptOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteTranscriptOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.fireflies.ai/graphql-api/query/transcript
        endpoint: '/graphql',
        data: {
          query: `
                    mutation DeleteTranscript($id: String!) {
                        deleteTranscript(id: $id) {
                            id
                        }
                    }
                `,
          variables: {
            id: input.id,
          },
        },
        retries: 3,
      });

      const parsed = ProviderResponseSchema.parse(response.data);

      if (parsed.errors && parsed.errors.length > 0) {
        const firstError = parsed.errors[0];
        if (!firstError) {
          throw new platformProxy.ActionError({
            type: 'graphql_error',
            message: 'Unknown GraphQL error.',
          });
        }
        throw new platformProxy.ActionError({
          type: firstError.code || 'graphql_error',
          message: firstError.message,
        });
      }

      if (parsed.data === undefined || parsed.data === null) {
        throw new platformProxy.ActionError({
          type: 'graphql_error',
          message: 'Unexpected GraphQL response: missing data field.',
        });
      }

      return {
        deleted: parsed.data.deleteTranscript !== undefined,
      };
    },
  });
}
