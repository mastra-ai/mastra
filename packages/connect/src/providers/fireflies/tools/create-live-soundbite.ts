// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createLiveSoundbiteInputSchema = z.object({
  meeting_id: z.string().describe('The ID of the live meeting to create the soundbite for. Example: "abc123"'),
  prompt: z
    .string()
    .min(5)
    .max(255)
    .describe(
      'Natural language description of the soundbite to create. Min 5, max 255 characters. Example: "Create a soundbite from the last 2 minutes"',
    ),
});

const ProviderResponseSchema = z.object({
  data: z.object({
    createLiveSoundbite: z.object({
      success: z.boolean(),
    }),
  }),
});

export const createLiveSoundbiteOutputSchema = z.object({
  success: z.boolean(),
});

export function createLiveSoundbiteTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_create_live_soundbite',
    description: 'Create a soundbite/clip during an active live meeting',
    inputSchema: createLiveSoundbiteInputSchema,
    outputSchema: createLiveSoundbiteOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createLiveSoundbiteOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.fireflies.ai/graphql-api/mutation/create-live-soundbite
        endpoint: '/graphql',
        data: {
          query:
            'mutation CreateLiveSoundbite($input: CreateLiveSoundbiteInput!) { createLiveSoundbite(input: $input) { success } }',
          variables: {
            input: {
              meeting_id: input.meeting_id,
              prompt: input.prompt,
            },
          },
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        success: providerResponse.data.createLiveSoundbite.success,
      };
    },
  });
}
