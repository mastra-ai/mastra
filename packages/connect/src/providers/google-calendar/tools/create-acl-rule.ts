// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createAclRuleInputSchema = z
  .object({
    calendarId: z
      .string()
      .describe('Calendar identifier. Use "primary" for the primary calendar of the currently logged in user.'),
    role: z
      .enum(['none', 'freeBusyReader', 'reader', 'writerWithoutPrivateAccess', 'writer', 'owner'])
      .describe('The role assigned to the scope.'),
    scope: z
      .object({
        type: z.enum(['default', 'user', 'group', 'domain']).describe('The type of the scope.'),
        value: z
          .string()
          .optional()
          .describe('The email address or domain name, depending on the scope type. Omit for type default.'),
      })
      .describe('The extent of calendar access granted by this ACL rule.'),
    sendNotifications: z
      .boolean()
      .optional()
      .describe('Whether to send notifications about the calendar sharing change. Defaults to true.'),
  })
  .describe('Input to create an access control rule for a calendar.');

const ProviderAclRuleSchema = z.object({
  id: z.string(),
  etag: z.string(),
  kind: z.string(),
  role: z.string(),
  scope: z.object({
    type: z.string(),
    value: z.string().optional(),
  }),
});

export const createAclRuleOutputSchema = z
  .object({
    id: z.string().describe('Identifier of the ACL rule.'),
    etag: z.string().describe('ETag of the resource.'),
    kind: z.string().describe('Type of the resource.'),
    role: z.string().describe('The role assigned to the scope.'),
    scope: z
      .object({
        type: z.string().describe('The type of the scope.'),
        value: z.string().optional().describe('The email address or domain name, depending on the scope type.'),
      })
      .describe('The extent of calendar access granted by this ACL rule.'),
  })
  .describe('An access control rule for a calendar.');

export function createAclRuleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_create_acl_rule',
    description: 'Create an access control rule',
    inputSchema: createAclRuleInputSchema,
    outputSchema: createAclRuleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createAclRuleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://developers.google.com/workspace/calendar/api/v3/reference/acl/insert
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/acl`,
        data: {
          role: input.role,
          scope: {
            type: input.scope.type,
            ...(input.scope.value !== undefined && { value: input.scope.value }),
          },
        },
        params: {
          ...(input.sendNotifications !== undefined && {
            sendNotifications: input.sendNotifications ? 'true' : 'false',
          }),
        },
        retries: 1,
      };

      const response = await platformProxy.post(config);

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'Provider did not return an ACL rule.',
        });
      }

      const providerRule = ProviderAclRuleSchema.parse(response.data);

      return {
        id: providerRule.id,
        etag: providerRule.etag,
        kind: providerRule.kind,
        role: providerRule.role,
        scope: {
          type: providerRule.scope.type,
          ...(providerRule.scope.value !== undefined && { value: providerRule.scope.value }),
        },
      };
    },
  });
}
