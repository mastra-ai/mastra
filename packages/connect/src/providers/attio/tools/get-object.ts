// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getObjectInputSchema = z.object({
  object: z.string().describe('A UUID or slug to identify the object. Example: "people"'),
});

const ProviderObjectIdSchema = z.object({
  workspace_id: z.string(),
  object_id: z.string(),
});

const ProviderObjectSchema = z.object({
  id: ProviderObjectIdSchema,
  api_slug: z.string().nullable(),
  singular_noun: z.string().nullable(),
  plural_noun: z.string().nullable(),
  created_at: z.string(),
});

export const getObjectOutputSchema = z.object({
  id: ProviderObjectIdSchema,
  api_slug: z.string().optional(),
  singular_noun: z.string().optional(),
  plural_noun: z.string().optional(),
  created_at: z.string(),
});

export function getObjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_get_object',
    description: 'Retrieve a single object from Attio.',
    inputSchema: getObjectInputSchema,
    outputSchema: getObjectOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getObjectOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.attio.com/rest-api/endpoint-reference/objects/get-an-object
      const response = await platformProxy.get({
        endpoint: `/v2/objects/${encodeURIComponent(input.object)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Object with slug/ID "${input.object}" not found.`,
        });
      }

      const providerObject = ProviderObjectSchema.parse(response.data.data);

      return {
        id: providerObject.id,
        ...(providerObject.api_slug != null && { api_slug: providerObject.api_slug }),
        ...(providerObject.singular_noun != null && { singular_noun: providerObject.singular_noun }),
        ...(providerObject.plural_noun != null && { plural_noun: providerObject.plural_noun }),
        created_at: providerObject.created_at,
      };
    },
  });
}
