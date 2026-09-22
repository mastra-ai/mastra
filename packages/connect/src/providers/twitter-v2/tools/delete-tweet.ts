// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteTweetInputSchema = z.object({
  id: z.string().describe('The ID of the tweet to be deleted. Example: "1346889436626259968"'),
});

const DeleteTweetResponseSchema = z.object({
  data: z
    .object({
      deleted: z.boolean(),
    })
    .optional(),
  errors: z
    .array(
      z.object({
        detail: z.string().optional(),
        status: z.number().optional(),
        title: z.string().optional(),
        type: z.string().optional(),
      }),
    )
    .optional(),
});

export const deleteTweetOutputSchema = z.object({
  success: z.boolean(),
  deleted: z.boolean().optional(),
  error: z.string().optional(),
});

export function deleteTweetTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_delete_tweet',
    description: 'Delete or archive a tweet in Twitter/X',
    inputSchema: deleteTweetInputSchema,
    outputSchema: deleteTweetOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteTweetOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.x.com/en/docs/x-api/tweets/manage-tweets/api-reference/delete-tweets-id
      const response = await platformProxy.delete({
        endpoint: `/2/tweets/${input.id}`,
        retries: 2,
      });

      const parsed = DeleteTweetResponseSchema.safeParse(response.data);

      if (!parsed.success) {
        throw new platformProxy.ActionError({
          message: 'Invalid response from X API',
        });
      }

      const data = parsed.data;

      if (data.errors && data.errors.length > 0) {
        const firstError = data.errors[0];
        if (firstError) {
          throw new platformProxy.ActionError({
            message: firstError.detail || firstError.title || 'Failed to delete tweet',
          });
        }
      }

      if (data.data && data.data.deleted) {
        return {
          success: true,
          deleted: true,
        };
      }

      return {
        success: false,
        error: 'Tweet was not deleted',
      };
    },
  });
}
