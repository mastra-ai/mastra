// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteAclRuleInputSchema = z
  .object({
    calendarId: z
      .string()
      .describe('Calendar identifier. To access calendar metadata for a primary calendar, use "primary".'),
    ruleId: z.string().describe('ACL rule identifier.'),
  })
  .describe('Parameters for deleting an access control rule.');

export const deleteAclRuleOutputSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful.'),
  calendarId: z.string().describe('The calendar ID from the request.'),
  ruleId: z.string().describe('The ACL rule ID that was deleted.'),
});

export function deleteAclRuleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_delete_acl_rule',
    description: 'Delete an access control rule',
    inputSchema: deleteAclRuleInputSchema,
    outputSchema: deleteAclRuleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteAclRuleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/calendar/api/v3/reference/acl/delete
      await platformProxy.delete({
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/acl/${encodeURIComponent(input.ruleId)}`,
        retries: 3,
      });

      return {
        success: true,
        calendarId: input.calendarId,
        ruleId: input.ruleId,
      };
    },
  });
}
