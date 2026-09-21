// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createObjectInputSchema = z.object({
  api_slug: z
    .string()
    .min(1)
    .describe(
      'A unique, human-readable slug to access the object through URLs and API calls. Should be formatted in snake case. Example: "people"',
    ),
  singular_noun: z.string().min(1).describe('The singular form of the object\'s name. Example: "Person"'),
  plural_noun: z.string().min(1).describe('The plural form of the object\'s name. Example: "People"'),
});

const ObjectIdSchema = z.object({
  workspace_id: z.string().uuid(),
  object_id: z.string().uuid(),
});

const ProviderObjectSchema = z.object({
  id: ObjectIdSchema,
  api_slug: z.string().nullable(),
  singular_noun: z.string().nullable(),
  plural_noun: z.string().nullable(),
  created_at: z.string(),
});

export const createObjectOutputSchema = z.object({
  id: z.string().uuid().describe('The UUID of the created object'),
  workspace_id: z.string().uuid().describe('The UUID of the workspace'),
  api_slug: z.string().describe('The API slug of the object'),
  singular_noun: z.string().describe('The singular noun of the object'),
  plural_noun: z.string().describe('The plural noun of the object'),
  created_at: z.string().describe('ISO 8601 timestamp when the object was created'),
});

export function createObjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_create_object',
    description: 'Create a custom object in Attio',
    inputSchema: createObjectInputSchema,
    outputSchema: createObjectOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createObjectOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.attio.com/rest-api/objects
        endpoint: '/v2/objects',
        data: {
          data: {
            api_slug: input.api_slug,
            singular_noun: input.singular_noun,
            plural_noun: input.plural_noun,
          },
        },
        retries: 3,
      });

      if (!response.data || !response.data.data) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Attio API',
        });
      }

      const providerObject = ProviderObjectSchema.parse(response.data.data);

      return {
        id: providerObject.id.object_id,
        workspace_id: providerObject.id.workspace_id,
        api_slug: providerObject.api_slug ?? '',
        singular_noun: providerObject.singular_noun ?? '',
        plural_noun: providerObject.plural_noun ?? '',
        created_at: providerObject.created_at,
      };
    },
  });
}
