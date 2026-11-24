// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';
import { zendeskId } from '../article.js';

export const deleteOrganizationInputSchema = z.object({
  organization_id: zendeskId('organization'),
});

export const deleteOrganizationOutputSchema = z.object({
  success: z.literal(true),
  organization_id: z.number(),
});

export function deleteOrganizationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_delete_organization',
    description: 'Delete an organization. Its users and tickets stay, but lose the organization.',
    inputSchema: deleteOrganizationInputSchema,
    outputSchema: deleteOrganizationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteOrganizationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.zendesk.com/api-reference/ticketing/organizations/organizations/#delete-organization
      await platformProxy.delete({
        endpoint: `/api/v2/organizations/${input.organization_id}.json`,
        retries: 1,
      });
      return { success: true, organization_id: input.organization_id };
    },
  });
}
