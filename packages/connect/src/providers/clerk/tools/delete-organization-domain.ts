// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteOrganizationDomainInputSchema = z.object({ organization_id: z.string(), domain_id: z.string() });

export const deleteOrganizationDomainOutputSchema = z.object({ id: z.string(), success: z.boolean() });

export function deleteOrganizationDomainTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_delete_organization_domain',
    description: 'Delete a verified domain from a Clerk organization.',
    inputSchema: deleteOrganizationDomainInputSchema,
    outputSchema: deleteOrganizationDomainOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteOrganizationDomainOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      await platformProxy.delete({
        // https://clerk.com/docs/reference/backend-api/tag/Organization-Domains#operation/DeleteOrganizationDomain
        endpoint: `/v1/organizations/${encodeURIComponent(input.organization_id)}/domains/${encodeURIComponent(input.domain_id)}`,
        retries: 3,
      });
      return { id: input.domain_id, success: true };
    },
  });
}
