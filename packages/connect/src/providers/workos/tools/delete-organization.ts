// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteOrganizationInputSchema = z.object({
  organization_id: z.string().min(1).describe('WorkOS organization ID. Example: "org_01H..."'),
});

export const deleteOrganizationOutputSchema = z.object({ id: z.string(), success: z.boolean() });

export function deleteOrganizationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_delete_organization',
    description: 'Permanently delete a WorkOS organization.',
    inputSchema: deleteOrganizationInputSchema,
    outputSchema: deleteOrganizationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteOrganizationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      await platformProxy.delete({
        // https://workos.com/docs/reference/organization
        endpoint: `/organizations/${encodeURIComponent(input.organization_id)}`,
        retries: 3,
      });
      return { id: input.organization_id, success: true };
    },
  });
}
