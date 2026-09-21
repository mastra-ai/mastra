// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createListInputSchema = z.object({
  name: z.string().describe('Name of the list. Example: "Tech News"'),
  description: z
    .string()
    .optional()
    .describe('Description for the list. Example: "Top tech journalists and publications"'),
  private: z.boolean().optional().describe('Whether the list is private. If true, only the owner can view the list.'),
});

const ProviderResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

export const createListOutputSchema = z.object({
  id: z.string().describe('Unique identifier of the created list.'),
  name: z.string().describe('Name of the created list.'),
});

type Input = z.infer<typeof createListInputSchema>;

type InputKey = keyof Input;

export function createListTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_create_list',
    description: 'Create a list in Twitter/X',
    inputSchema: createListInputSchema,
    outputSchema: createListOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createListOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Safe property access through intermediate object
      const safeInput: Record<string, unknown> = input;
      const payload: Record<string, unknown> = {
        name: safeInput['name'],
      };

      const descriptionKey: InputKey = 'description';
      if (safeInput[descriptionKey] !== undefined) {
        payload['description'] = safeInput[descriptionKey];
      }

      const privateKey: InputKey = 'private';
      if (safeInput[privateKey] !== undefined) {
        payload['private'] = safeInput[privateKey];
      }

      // https://docs.x.com/x-api/lists/manage-lists/api-reference/post-lists
      const response = await platformProxy.post({
        endpoint: '/2/lists',
        data: payload,
        retries: 10,
      });

      const parsed = ProviderResponseSchema.parse(response.data);

      return {
        id: parsed.data.id,
        name: parsed.data.name,
      };
    },
  });
}
