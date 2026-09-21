// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listFiltersInputSchema = z.object({
  userId: z.string().optional().describe('User ID. Use "me" for the authenticated user. Defaults to "me".'),
});

const FilterCriteriaSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  subject: z.string().optional(),
  query: z.string().optional(),
  negatedQuery: z.string().optional(),
  hasAttachment: z.boolean().optional(),
  excludeChats: z.boolean().optional(),
  size: z.number().optional(),
  sizeComparison: z.string().optional(),
});

const FilterActionSchema = z.object({
  addLabelIds: z.array(z.string()).optional(),
  removeLabelIds: z.array(z.string()).optional(),
  forward: z.string().optional(),
});

const FilterSchema = z.object({
  id: z.string(),
  criteria: FilterCriteriaSchema.optional(),
  action: FilterActionSchema.optional(),
});

export const listFiltersOutputSchema = z.object({
  filters: z.array(FilterSchema),
  nextCursor: z.string().optional(),
});

const ProviderListResponseSchema = z.object({
  filter: z.array(z.unknown()).optional(),
});

export function listFiltersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_list_filters',
    description: 'List mailbox filters configured for the authenticated user',
    inputSchema: listFiltersInputSchema,
    outputSchema: listFiltersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listFiltersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const userId = input.userId ?? 'me';

      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.filters/list
      const response = await platformProxy.get({
        endpoint: `/gmail/v1/users/${encodeURIComponent(userId)}/settings/filters`,
        retries: 3,
      });

      const parsedData = ProviderListResponseSchema.parse(response.data);
      const filters = parsedData.filter || [];

      const parsedFilters = filters.map((item: unknown) => {
        const parsed = FilterSchema.parse(item);
        return parsed;
      });

      return {
        filters: parsedFilters,
      };
    },
  });
}
