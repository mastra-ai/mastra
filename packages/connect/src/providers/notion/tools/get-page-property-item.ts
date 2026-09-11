// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getPagePropertyItemInputSchema = z.object({
  page_id: z
    .string()
    .describe('The ID of the page containing the property. Example: "b55c9c91-384d-452b-81db-d1ef79372b75"'),
  property_id: z
    .string()
    .describe(
      'The ID or name of the property to retrieve. Can be a property ID (e.g., "title", "%3E%5DWj") or property name (e.g., "Name", "Status"). Property IDs are more stable if properties are renamed.',
    ),
  start_cursor: z
    .string()
    .optional()
    .describe(
      'Pagination cursor for properties with many values (title, rich_text, relation, people). Omit for the first page.',
    ),
  page_size: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe('Number of results to return per page. Maximum is 100. Default: 100.'),
});

const PropertyItemSchema = z
  .object({
    object: z.literal('property_item'),
    id: z.string(),
    type: z.string(),
    // The actual value is stored under a key matching the type
    // This will be handled as passthrough for flexibility
  })
  .passthrough();

const PropertyItemListSchema = z.object({
  object: z.literal('list'),
  type: z.string(),
  results: z.array(z.object({}).passthrough()),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
  // Property item metadata in list response is a simpler object
  property_item: z.object({}).passthrough().optional(),
});

export const getPagePropertyItemOutputSchema = z.union([PropertyItemSchema, PropertyItemListSchema]);

export function getPagePropertyItemTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_get_page_property_item',
    description: 'Retrieve a single property item value from a page.',
    inputSchema: getPagePropertyItemInputSchema,
    outputSchema: getPagePropertyItemOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getPagePropertyItemOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.notion.com/reference/retrieve-a-page-property-item
      const response = await platformProxy.get({
        endpoint: `/v1/pages/${encodeURIComponent(input.page_id)}/properties/${encodeURIComponent(input.property_id)}`,
        params: {
          ...(input.start_cursor && { start_cursor: input.start_cursor }),
          ...(input.page_size !== undefined && { page_size: input.page_size.toString() }),
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Page property not found',
          page_id: input.page_id,
          property_id: input.property_id,
        });
      }

      // The response can be either a single property_item or a paginated list
      // Use type guard to safely check response structure
      if (typeof response.data !== 'object' || response.data === null) {
        throw new platformProxy.ActionError({
          type: 'unexpected_response',
          message: 'Response data is not an object',
        });
      }

      // Safely access the object property using bracket notation
      const responseData = response.data;
      const objectType = 'object' in responseData ? responseData.object : undefined;

      if (objectType === 'property_item') {
        // Single property item
        const parsed = PropertyItemSchema.safeParse(responseData);
        if (!parsed.success) {
          throw new platformProxy.ActionError({
            type: 'validation_error',
            message: 'Failed to parse property item response',
            errors: parsed.error.issues,
          });
        }
        return parsed.data;
      } else if (objectType === 'list') {
        // Paginated list of property items
        const parsed = PropertyItemListSchema.safeParse(responseData);
        if (!parsed.success) {
          throw new platformProxy.ActionError({
            type: 'validation_error',
            message: 'Failed to parse property item list response',
            errors: parsed.error.issues,
          });
        }
        return parsed.data;
      } else {
        throw new platformProxy.ActionError({
          type: 'unexpected_response',
          message: 'Unexpected response object type from Notion API',
          object_type: String(objectType),
        });
      }
    },
  });
}
