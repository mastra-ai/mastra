// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getAclRuleInputSchema = z
  .object({
    calendarId: z
      .string()
      .describe('Calendar identifier. Use "primary" for the primary calendar of the authenticated user.'),
    ruleId: z.string().describe('ACL rule identifier.'),
  })
  .describe('Input to retrieve a single access control rule from a calendar.');

const ProviderAclRuleSchema = z.object({
  kind: z.string().optional(),
  etag: z.string().optional(),
  id: z.string(),
  scope: z
    .object({
      type: z.string(),
      value: z.string().optional(),
    })
    .optional(),
  role: z.string(),
});

export const getAclRuleOutputSchema = z
  .object({
    id: z.string().describe('Identifier of the ACL rule.'),
    role: z
      .string()
      .describe(
        'The role assigned to the scope. Possible values: none, freeBusyReader, reader, writerWithoutPrivateAccess, writer, owner.',
      ),
    scope: z
      .object({
        type: z.string().describe('The type of the scope. Possible values: default, user, group, domain.'),
        value: z
          .string()
          .optional()
          .describe('The email address of a user or group, or the name of a domain. Omitted for type default.'),
      })
      .optional()
      .describe('The extent to which calendar access is granted by this ACL rule.'),
    kind: z.string().optional().describe('Type of the resource ("calendar#aclRule").'),
    etag: z.string().optional().describe('ETag of the resource.'),
  })
  .describe('A single access control rule for a calendar.');

export function getAclRuleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_get_acl_rule',
    description: 'Get an access control rule by ID',
    inputSchema: getAclRuleInputSchema,
    outputSchema: getAclRuleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getAclRuleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://developers.google.com/workspace/calendar/api/v3/reference/acl/get
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/acl/${encodeURIComponent(input.ruleId)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `ACL rule ${input.ruleId} not found on calendar ${input.calendarId}`,
        });
      }

      const providerAclRule = ProviderAclRuleSchema.parse(response.data);

      return {
        id: providerAclRule.id,
        role: providerAclRule.role,
        ...(providerAclRule.scope !== undefined && {
          scope: {
            type: providerAclRule.scope.type,
            ...(providerAclRule.scope.value !== undefined && { value: providerAclRule.scope.value }),
          },
        }),
        ...(providerAclRule.kind !== undefined && { kind: providerAclRule.kind }),
        ...(providerAclRule.etag !== undefined && { etag: providerAclRule.etag }),
      };
    },
  });
}
