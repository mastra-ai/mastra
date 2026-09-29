// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteOrganizationInputSchema = z.object({ organization_id: z.string().min(1) });

export const deleteOrganizationOutputSchema = z.object({ id: z.string(), success: z.boolean() });

export function deleteOrganizationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_delete_organization',
    description: 'Delete a Clerk organization.',
    inputSchema: deleteOrganizationInputSchema,
    outputSchema: deleteOrganizationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteOrganizationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://clerk.com/docs/reference/backend-api/tag/Organizations#operation/DeleteOrganization
      await platformProxy.delete({
        endpoint: `/v1/organizations/${encodeURIComponent(input.organization_id)}`,
        retries: 3,
      });
      return { id: input.organization_id, success: true };
    },
  });
}
