// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listAttributesInputSchema = z.object({
  target: z
    .enum(['objects', 'lists'])
    .optional()
    .describe("Whether to list attributes for an object or a list. Defaults to 'objects'."),
  identifier: z.string().describe("Object or list identifier (UUID or slug). Example: 'people'"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe('Maximum number of attributes to return. Defaults to 500.'),
  offset: z.number().int().min(0).optional().describe('Number of attributes to skip for pagination.'),
});

const AttributeSchema = z.object({
  id: z.object({
    workspace_id: z.string(),
    object_id: z.string().optional(),
    list_id: z.string().optional(),
    attribute_id: z.string(),
  }),
  title: z.string(),
  description: z.string().nullish(),
  api_slug: z.string(),
  type: z.string(),
  is_system_attribute: z.boolean().nullish(),
  is_writable: z.boolean().nullish(),
  is_required: z.boolean().nullish(),
  is_unique: z.boolean().nullish(),
  is_multiselect: z.boolean().nullish(),
  is_archived: z.boolean().nullish(),
  is_default_value_enabled: z.boolean().nullish(),
  default_value: z.unknown().nullish(),
  relationship: z.unknown().nullish(),
  created_at: z.string().nullish(),
  config: z.unknown().nullish(),
});

const ProviderResponseSchema = z.object({
  data: z.array(AttributeSchema.passthrough()),
});

export const listAttributesOutputSchema = z.object({
  attributes: z.array(AttributeSchema),
});

export function listAttributesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_list_attributes',
    description:
      'List the attribute definitions (schema) of an Attio object or list, including api_slug, type, and configuration of each attribute.',
    inputSchema: listAttributesInputSchema,
    outputSchema: listAttributesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listAttributesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const parsedInput = await platformProxy.zodValidateInput({ zodSchema: listAttributesInputSchema, input });

      const target = parsedInput.data.target ?? 'objects';

      const config: PlatformProxyRequest = {
        // https://docs.attio.com/rest-api/endpoint-reference/attributes/list-attributes
        endpoint: `/v2/${target}/${encodeURIComponent(parsedInput.data.identifier)}/attributes`,
        params: {
          ...(parsedInput.data.limit !== undefined && { limit: parsedInput.data.limit }),
          ...(parsedInput.data.offset !== undefined && { offset: parsedInput.data.offset }),
        },
        retries: 3,
      };

      const response = await platformProxy.get(config);

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        attributes: providerResponse.data.map(attribute => ({
          id: attribute.id,
          title: attribute.title,
          description: attribute.description,
          api_slug: attribute.api_slug,
          type: attribute.type,
          is_system_attribute: attribute.is_system_attribute,
          is_writable: attribute.is_writable,
          is_required: attribute.is_required,
          is_unique: attribute.is_unique,
          is_multiselect: attribute.is_multiselect,
          is_archived: attribute.is_archived,
          is_default_value_enabled: attribute.is_default_value_enabled,
          default_value: attribute.default_value,
          relationship: attribute.relationship,
          created_at: attribute.created_at,
          config: attribute.config,
        })),
      };
    },
  });
}
