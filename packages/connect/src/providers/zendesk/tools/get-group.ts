// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getGroupInputSchema = z.object({
  group_id: z.number().describe('Group ID. Example: 123456'),
});

const ProviderGroupSchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted: z.boolean().optional(),
});

export const getGroupOutputSchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted: z.boolean().optional(),
});

export function getGroupTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_get_group',
    description: 'Retrieve a group by ID.',
    inputSchema: getGroupInputSchema,
    outputSchema: getGroupOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getGroupOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.zendesk.com/api-reference/ticketing/groups/groups/#show-group
      const response = await platformProxy.get({
        endpoint: `/api/v2/groups/${encodeURIComponent(input.group_id)}.json`,
        retries: 3,
      });

      if (!response.data || !response.data.group) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Group not found',
          group_id: input.group_id,
        });
      }

      const providerGroup = ProviderGroupSchema.parse(response.data.group);

      return {
        id: providerGroup.id,
        name: providerGroup.name,
        ...(providerGroup.url !== undefined && { url: providerGroup.url }),
        ...(providerGroup.created_at !== undefined && { created_at: providerGroup.created_at }),
        ...(providerGroup.updated_at !== undefined && { updated_at: providerGroup.updated_at }),
        ...(providerGroup.deleted !== undefined && { deleted: providerGroup.deleted }),
      };
    },
  });
}
