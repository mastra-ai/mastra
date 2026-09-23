// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listAclRulesInputSchema = z
  .object({
    calendarId: z
      .string()
      .describe('Calendar identifier. Use "primary" for the primary calendar of the currently logged in user.'),
    cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
    maxResults: z
      .number()
      .optional()
      .describe('Maximum number of entries returned on one result page. Default is 100, maximum is 250.'),
    showDeleted: z
      .boolean()
      .optional()
      .describe('Whether to include deleted ACLs in the result. Deleted ACLs have role equal to "none".'),
  })
  .describe('Input parameters for listing ACL rules of a Google Calendar.');

const ScopeSchema = z.object({
  type: z.string().describe('The type of the scope. Possible values are "default", "user", "group", or "domain".'),
  value: z
    .string()
    .optional()
    .describe('The email address of a user or group, or the name of a domain. Omitted for type "default".'),
});

const AclRuleSchema = z.object({
  id: z.string().describe('Identifier of the ACL rule.'),
  role: z
    .string()
    .describe(
      'The role assigned to the scope. Possible values are "none", "freeBusyReader", "reader", "writerWithoutPrivateAccess", "writer", and "owner".',
    ),
  scope: ScopeSchema.describe('The extent to which calendar access is granted by this ACL rule.'),
  etag: z.string().optional().describe('ETag of the resource.'),
  kind: z.string().optional().describe('Type of the resource.'),
});

export const listAclRulesOutputSchema = z
  .object({
    items: z.array(AclRuleSchema).describe('List of ACL rules for the calendar.'),
    nextPageToken: z
      .string()
      .optional()
      .describe('Token for retrieving the next page of results. Omitted when there are no further results.'),
  })
  .describe('Paginated list of ACL rules for a Google Calendar.');

const ProviderAclListSchema = z.object({
  kind: z.string().optional(),
  etag: z.string().optional(),
  nextPageToken: z.string().optional(),
  nextSyncToken: z.string().optional(),
  items: z
    .array(
      z.object({
        kind: z.string().optional(),
        etag: z.string().optional(),
        id: z.string(),
        scope: z.object({
          type: z.string(),
          value: z.string().optional(),
        }),
        role: z.string(),
      }),
    )
    .optional(),
});

export function listAclRulesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_list_acl_rules',
    description: 'List ACL rules for a calendar with pagination support',
    inputSchema: listAclRulesInputSchema,
    outputSchema: listAclRulesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listAclRulesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://developers.google.com/calendar/api/v3/reference/acl/list
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/acl`,
        params: {
          ...(input.cursor !== undefined && { pageToken: input.cursor }),
          ...(input.maxResults !== undefined && { maxResults: String(input.maxResults) }),
          ...(input.showDeleted !== undefined && { showDeleted: String(input.showDeleted) }),
        },
        retries: 3,
      });

      const providerList = ProviderAclListSchema.parse(response.data);

      return {
        items: (providerList.items || []).map(item => ({
          id: item.id,
          role: item.role,
          scope: {
            type: item.scope.type,
            ...(item.scope.value !== undefined && { value: item.scope.value }),
          },
          ...(item.etag !== undefined && { etag: item.etag }),
          ...(item.kind !== undefined && { kind: item.kind }),
        })),
        ...(providerList.nextPageToken !== undefined && { nextPageToken: providerList.nextPageToken }),
      };
    },
  });
}
