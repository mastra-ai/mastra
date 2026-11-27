// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listViewsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const ViewSchema = z.object({
  id: z.number(),
  title: z.string(),
  active: z.boolean().optional(),
  default: z.boolean().optional(),
  description: z.string().nullable().optional(),
  position: z.number().optional(),
  conditions: z.object({}).passthrough().optional(),
  execution: z.object({}).passthrough().optional(),
  restriction: z.union([z.object({}).passthrough(), z.null()]).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

const ProviderResponseSchema = z.object({
  views: z.array(ViewSchema),
  meta: z
    .object({
      has_more: z.boolean().optional(),
      after_cursor: z.string().nullish(),
      before_cursor: z.string().nullish(),
    })
    .optional(),
  count: z.number().optional(),
});

const ViewOutputSchema = z.object({
  id: z.number(),
  title: z.string(),
  active: z.boolean().optional(),
  default: z.boolean().optional(),
  description: z.string().optional(),
  position: z.number().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const listViewsOutputSchema = z.object({
  views: z.array(ViewOutputSchema),
  next_cursor: z.string().optional(),
});

export function listViewsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_list_views',
    description: 'List ticket views for the account',
    inputSchema: listViewsInputSchema,
    outputSchema: listViewsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listViewsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.zendesk.com/api-reference/ticketing/business-rules/views/#list-views
      const response = await platformProxy.get({
        endpoint: '/api/v2/views.json',
        params: {
          ...(input.cursor && { 'page[after]': input.cursor }),
          'page[size]': 100,
        },
        retries: 3,
      });

      const parsed = ProviderResponseSchema.parse(response.data);

      return {
        views: parsed.views.map(view => ({
          id: view.id,
          title: view.title,
          ...(view.active !== undefined && { active: view.active }),
          ...(view.default !== undefined && { default: view.default }),
          ...(view.description != null && { description: view.description }),
          ...(view.position !== undefined && { position: view.position }),
          ...(view.created_at !== undefined && { created_at: view.created_at }),
          ...(view.updated_at !== undefined && { updated_at: view.updated_at }),
        })),
        ...(parsed.meta?.has_more && parsed.meta.after_cursor && { next_cursor: parsed.meta.after_cursor }),
      };
    },
  });
}
