// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteSpamReportsInputSchema = z.object({
  emails: z.array(z.string()).optional().describe('Email addresses to remove from spam reports. Example: ["a@x.com"]'),
  delete_all: z.boolean().optional().describe('Set to true to remove all spam reports.'),
});

export const deleteSpamReportsOutputSchema = z.object({
  success: z.boolean(),
});

export function deleteSpamReportsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_delete_spam_reports',
    description: 'Clear spam-report suppressions for one or more addresses, or all of them.',
    inputSchema: deleteSpamReportsInputSchema,
    outputSchema: deleteSpamReportsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteSpamReportsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if (input.delete_all !== true && (input.emails === undefined || input.emails.length === 0)) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'Either delete_all must be true or emails must contain at least one address.',
        });
      }

      const body: { delete_all?: boolean; emails?: string[] } = {};
      if (input.delete_all === true) {
        body.delete_all = true;
      } else if (input.emails !== undefined && input.emails.length > 0) {
        body.emails = input.emails;
      }

      await platformProxy.delete({
        // https://www.twilio.com/docs/sendgrid/api-reference/suppressions-spam-reports/delete-spam-reports
        endpoint: '/v3/suppression/spam_reports',
        data: body,
        retries: 3,
      });

      return { success: true };
    },
  });
}
