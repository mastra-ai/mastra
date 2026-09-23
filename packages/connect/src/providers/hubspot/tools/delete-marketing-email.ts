// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteMarketingEmailInputSchema = z.object({
  emailId: z.string().describe('The ID of the marketing email to delete. Example: "12345"'),
});

export const deleteMarketingEmailOutputSchema = z.object({
  success: z.boolean(),
  emailId: z.string(),
  message: z.string(),
});

export function deleteMarketingEmailTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_delete_marketing_email',
    description: 'Delete a marketing email',
    inputSchema: deleteMarketingEmailInputSchema,
    outputSchema: deleteMarketingEmailOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteMarketingEmailOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api-reference/marketing-marketing-emails-v3/marketing-emails/delete-marketing-v3-emails-emailId
      await platformProxy.delete({
        endpoint: `/marketing/v3/emails/${input.emailId}`,
        retries: 3,
      });

      return {
        success: true,
        emailId: input.emailId,
        message: `Marketing email ${input.emailId} deleted successfully`,
      };
    },
  });
}
