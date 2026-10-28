// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteCompanyInputSchema = z.object({
  id: z.string().describe('HubSpot Company ID to delete. Example: "123456789"'),
});

export const deleteCompanyOutputSchema = z.object({
  success: z.boolean(),
  id: z.string(),
});

export function deleteCompanyTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_delete_company',
    description: 'Delete a company record',
    inputSchema: deleteCompanyInputSchema,
    outputSchema: deleteCompanyOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteCompanyOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api-reference/crm-companies-v3/basic/delete-crm-v3-objects-companies-companyId
      await platformProxy.delete({
        endpoint: `/crm/v3/objects/companies/${input.id}`,
        retries: 3,
      });

      return {
        success: true,
        id: input.id,
      };
    },
  });
}
