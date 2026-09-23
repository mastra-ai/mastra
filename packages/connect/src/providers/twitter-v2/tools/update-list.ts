// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateListInputSchema = z.object({
  id: z.string().describe('The ID of the List to modify. Example: "1146654567674912769"'),
  name: z.string().min(1).max(25).optional().describe('The name of the List. Example: "test v2 update list"'),
  description: z.string().max(100).optional().describe('The description of the List. Example: "example update"'),
  private: z.boolean().optional().describe('Determines whether the List should be private.'),
});

const ProviderResponseSchema = z.object({
  data: z
    .object({
      updated: z.boolean(),
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

export const updateListOutputSchema = z.object({
  updated: z.boolean(),
});

export function updateListTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_update_list',
    description: 'Update a list in Twitter/X.',
    inputSchema: updateListInputSchema,
    outputSchema: updateListOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateListOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if (input.name === undefined && input.description === undefined && input.private === undefined) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'At least one of name, description, or private must be provided to update a list.',
        });
      }

      const response = await platformProxy.put({
        // https://developer.x.com/en/docs/twitter-api/lists/manage-lists/api-reference/put-lists-id
        endpoint: `/2/lists/${input.id}`,
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.private !== undefined && { private: input.private }),
        },
        retries: 10,
      });

      const parsed = ProviderResponseSchema.parse(response.data);

      const firstError = parsed.errors?.[0];
      if (firstError) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: firstError.title || 'Unknown provider error',
          detail: firstError.detail,
          status: firstError.status,
        });
      }

      if (!parsed.data || parsed.data.updated === undefined) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Provider response did not include update confirmation.',
        });
      }

      return {
        updated: parsed.data.updated,
      };
    },
  });
}
