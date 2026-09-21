// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createLiveActionItemInputSchema = z.object({
  meeting_id: z.string().describe('The ID of the live meeting to create the action item for. Example: "abc123"'),
  prompt: z
    .string()
    .describe(
      'Natural language description of the action item to create. Example: "Follow up with the client about the proposal"',
    ),
});

const ProviderResponseSchema = z.object({
  data: z
    .object({
      createLiveActionItem: z
        .object({
          success: z.boolean(),
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
      }),
    )
    .optional(),
});

export const createLiveActionItemOutputSchema = z.object({
  success: z.boolean(),
});

export function createLiveActionItemTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_create_live_action_item',
    description: 'Create a live action item during an active meeting.',
    inputSchema: createLiveActionItemInputSchema,
    outputSchema: createLiveActionItemOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createLiveActionItemOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.fireflies.ai/graphql-api/mutation/create-live-action-item
        endpoint: '/graphql',
        data: {
          query:
            'mutation CreateLiveActionItem($input: CreateLiveActionItemInput!) { createLiveActionItem(input: $input) { success } }',
          variables: {
            input: {
              meeting_id: input.meeting_id,
              prompt: input.prompt,
            },
          },
        },
        retries: 3,
      });

      const parsed = ProviderResponseSchema.parse(response.data);
      const result = parsed.data?.createLiveActionItem;

      if (!result) {
        const firstError = parsed.errors?.[0];
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: firstError?.message || 'Failed to create live action item.',
        });
      }

      return {
        success: result.success,
      };
    },
  });
}
