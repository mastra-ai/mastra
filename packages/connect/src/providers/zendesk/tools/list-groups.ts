// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listGroupsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const ProviderGroupSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  default: z.boolean().optional(),
  deleted: z.boolean().optional(),
  is_public: z.boolean().optional(),
});

const GroupSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  default: z.boolean().optional(),
  deleted: z.boolean().optional(),
  is_public: z.boolean().optional(),
});

export const listGroupsOutputSchema = z.object({
  items: z.array(GroupSchema),
  next_cursor: z.string().optional(),
});

const ProviderResponseSchema = z.object({
  groups: z.array(ProviderGroupSchema),
  meta: z
    .object({
      has_more: z.boolean().optional(),
      after_cursor: z.string().nullish(),
      before_cursor: z.string().nullish(),
    })
    .optional(),
});

export function listGroupsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_list_groups',
    description: 'List support groups',
    inputSchema: listGroupsInputSchema,
    outputSchema: listGroupsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listGroupsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.zendesk.com/api-reference/ticketing/groups/groups/
      const response = await platformProxy.get({
        endpoint: '/api/v2/groups.json',
        params: {
          ...(input.cursor && { 'page[after]': input.cursor }),
          'page[size]': 100,
        },
        retries: 3,
      });

      const responseData = ProviderResponseSchema.parse(response.data);

      return {
        items: responseData.groups.map(group => ({
          id: group.id,
          name: group.name,
          ...(group.description != null && { description: group.description }),
          url: group.url,
          created_at: group.created_at,
          updated_at: group.updated_at,
          ...(group.default !== undefined && { default: group.default }),
          ...(group.deleted !== undefined && { deleted: group.deleted }),
          ...(group.is_public !== undefined && { is_public: group.is_public }),
        })),
        ...(responseData.meta?.has_more &&
          responseData.meta.after_cursor && { next_cursor: responseData.meta.after_cursor }),
      };
    },
  });
}
