// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateObjectInputSchema = z
  .object({
    object: z.string().describe('A UUID or slug to identify the object. Example: "people"'),
    api_slug: z
      .string()
      .optional()
      .describe(
        'A unique, human-readable slug to access the object through URLs and API calls. Formatted in snake case.',
      ),
    singular_noun: z.string().optional().describe("The singular form of the object's name."),
    plural_noun: z.string().optional().describe("The plural form of the object's name."),
  })
  .superRefine((data, ctx) => {
    if (data.api_slug === undefined && data.singular_noun === undefined && data.plural_noun === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one of api_slug, singular_noun, or plural_noun must be provided.',
      });
    }
  });

const ObjectIdSchema = z.object({
  workspace_id: z.string(),
  object_id: z.string(),
});

const ProviderObjectSchema = z.object({
  id: ObjectIdSchema,
  api_slug: z.string().nullable(),
  singular_noun: z.string().nullable(),
  plural_noun: z.string().nullable(),
  created_at: z.string(),
});

const ProviderResponseSchema = z.object({
  data: ProviderObjectSchema,
});

export const updateObjectOutputSchema = z.object({
  id: z.object({
    workspace_id: z.string(),
    object_id: z.string(),
  }),
  api_slug: z.string().optional(),
  singular_noun: z.string().optional(),
  plural_noun: z.string().optional(),
  created_at: z.string(),
});

export function updateObjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_update_object',
    description: 'Update an object in Attio.',
    inputSchema: updateObjectInputSchema,
    outputSchema: updateObjectOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateObjectOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.patch({
        // https://docs.attio.com/rest-api/endpoint-reference/objects
        endpoint: `/v2/objects/${input.object}`,
        data: {
          data: {
            ...(input.api_slug !== undefined && { api_slug: input.api_slug }),
            ...(input.singular_noun !== undefined && { singular_noun: input.singular_noun }),
            ...(input.plural_noun !== undefined && { plural_noun: input.plural_noun }),
          },
        },
        retries: 3,
      });

      const parsed = ProviderResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Failed to parse provider response',
          details: parsed.error.issues,
        });
      }

      const providerObject = parsed.data.data;

      return {
        id: providerObject.id,
        ...(providerObject.api_slug !== null && { api_slug: providerObject.api_slug }),
        ...(providerObject.singular_noun !== null && { singular_noun: providerObject.singular_noun }),
        ...(providerObject.plural_noun !== null && { plural_noun: providerObject.plural_noun }),
        created_at: providerObject.created_at,
      };
    },
  });
}
