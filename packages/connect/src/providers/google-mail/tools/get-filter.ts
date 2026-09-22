// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getFilterInputSchema = z.object({
  id: z.string().describe('The ID of the filter to retrieve. Example: "ANeLbv78uP8GVB5D7xQf1fIlIaHoeFC0fV6lCu1"'),
});

const FilterCriteriaSchema = z.object({
  from: z.string().optional().describe("The sender's display name or email address"),
  to: z.string().optional().describe("The recipient's display name or email address"),
  subject: z.string().optional().describe("Case-insensitive phrase found in the message's subject"),
  query: z.string().optional().describe('Only return messages matching the specified query'),
  negatedQuery: z.string().optional().describe('Only return messages not matching the specified query'),
  hasAttachment: z.boolean().optional().describe('Whether the message has any attachment'),
  excludeChats: z.boolean().optional().describe('Whether the response should exclude chats'),
  size: z.number().optional().describe('The size of the entire RFC822 message in bytes'),
  sizeComparison: z
    .enum(['unspecified', 'smaller', 'larger'])
    .or(z.string())
    .optional()
    .describe('How the message size should be in relation to the size field'),
});

const FilterActionSchema = z.object({
  addLabelIds: z.array(z.string()).optional().describe('List of labels to add to the message'),
  removeLabelIds: z.array(z.string()).optional().describe('List of labels to remove from the message'),
  forward: z.string().optional().describe('Email address that the message should be forwarded to'),
});

const ProviderFilterSchema = z.object({
  id: z.string(),
  criteria: FilterCriteriaSchema.optional(),
  action: FilterActionSchema.optional(),
});

export const getFilterOutputSchema = z.object({
  id: z.string(),
  criteria: FilterCriteriaSchema.optional(),
  action: FilterActionSchema.optional(),
});

export function getFilterTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_get_filter',
    description: 'Retrieve a mailbox filter by filter ID.',
    inputSchema: getFilterInputSchema,
    outputSchema: getFilterOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getFilterOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.filters/get
      const response = await platformProxy.get({
        endpoint: `/gmail/v1/users/me/settings/filters/${encodeURIComponent(input.id)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Filter not found',
          id: input.id,
        });
      }

      const providerFilter = ProviderFilterSchema.parse(response.data);

      return {
        id: providerFilter.id,
        ...(providerFilter.criteria && { criteria: providerFilter.criteria }),
        ...(providerFilter.action && { action: providerFilter.action }),
      };
    },
  });
}
