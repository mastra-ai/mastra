// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteOrganizationDomainInputSchema = z.object({ organization_domain_id: z.string() });

export const deleteOrganizationDomainOutputSchema = z.object({ id: z.string(), success: z.boolean() });

export function deleteOrganizationDomainTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_delete_organization_domain',
    description: 'Delete a WorkOS organization domain.',
    inputSchema: deleteOrganizationDomainInputSchema,
    outputSchema: deleteOrganizationDomainOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteOrganizationDomainOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      await platformProxy.delete({
        // https://workos.com/docs/reference/organization-domain
        endpoint: `/organization_domains/${encodeURIComponent(input.organization_domain_id)}`,
        retries: 3,
      });
      return { id: input.organization_domain_id, success: true };
    },
  });
}
