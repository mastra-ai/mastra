// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getUserInputSchema = z.object({
  accountId: z.string().describe('The account ID of the user to retrieve. Example: "5b10ac8d82e05b22cc7d4ef5"'),
  expand: z
    .string()
    .optional()
    .describe(
      'Additional user details to include in the response. Comma-separated list of: groups, applicationRoles. Example: "groups,applicationRoles"',
    ),
});

const ProviderUserSchema = z.object({
  self: z.string(),
  accountId: z.string(),
  accountType: z.string().optional(),
  emailAddress: z.string().optional(),
  avatarUrls: z.record(z.string(), z.string()).optional(),
  displayName: z.string().optional(),
  active: z.boolean().optional(),
  timeZone: z.string().optional(),
  locale: z.string().optional(),
  groups: z
    .object({
      size: z.number(),
      items: z.array(
        z.object({
          name: z.string(),
          self: z.string(),
        }),
      ),
    })
    .optional(),
  applicationRoles: z
    .object({
      size: z.number(),
      items: z.array(
        z.object({
          key: z.string(),
          name: z.string(),
        }),
      ),
    })
    .optional(),
});

export const getUserOutputSchema = z.object({
  accountId: z.string(),
  accountType: z.string().optional(),
  emailAddress: z.string().optional(),
  displayName: z.string().optional(),
  active: z.boolean().optional(),
  timeZone: z.string().optional(),
  locale: z.string().optional(),
  avatarUrls: z.record(z.string(), z.string()).optional(),
  groups: z
    .array(
      z.object({
        name: z.string(),
        self: z.string(),
      }),
    )
    .optional(),
  applicationRoles: z
    .array(
      z.object({
        key: z.string(),
        name: z.string(),
      }),
    )
    .optional(),
});

const AccessibleResourceSchema = z.object({
  id: z.string(),
  url: z.string(),
  name: z.string(),
  scopes: z.array(z.string()),
  avatarUrl: z.string(),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
  baseUrl: z.string().optional(),
});

export function getUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_get_user',
    description: 'Retrieve a Jira user by account ID',
    inputSchema: getUserInputSchema,
    outputSchema: getUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const config = connection.connection_config;

      let cloudId: string | undefined;
      let baseUrl: string | undefined;

      if (config) {
        cloudId = config['cloudId'];
        baseUrl = config['baseUrl'];
      }

      if (!cloudId || !baseUrl) {
        const metadata = await platformProxy.getMetadata<z.infer<typeof MetadataSchema>>();
        cloudId = metadata?.cloudId;
        baseUrl = metadata?.baseUrl;
      }

      if (!cloudId) {
        const response = await platformProxy.get({
          // https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/#2-get-a-list-of-sites-the-user-can-access
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const resources = z.array(AccessibleResourceSchema).parse(response.data);

        if (!resources || resources.length === 0) {
          throw new platformProxy.ActionError({
            type: 'no_accessible_resources',
            message: 'No accessible Jira resources found for this connection',
          });
        }

        const firstResource = resources[0];
        if (!firstResource) {
          throw new platformProxy.ActionError({
            type: 'no_accessible_resources',
            message: 'No accessible Jira resources found for this connection',
          });
        }

        cloudId = firstResource.id;
        try {
          await platformProxy.updateMetadata({ cloudId, baseUrl: firstResource.url });
        } catch {
          // best-effort cache; user retrieval should still succeed
        }
      }

      if (!cloudId) {
        throw new platformProxy.ActionError({
          type: 'missing_cloud_id',
          message: 'Unable to resolve Jira cloud ID',
        });
      }

      const params: Record<string, string> = {
        accountId: input['accountId'],
      };

      const expandValue = input['expand'];
      if (expandValue) {
        params['expand'] = expandValue;
      }

      const response = await platformProxy.get({
        // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-users/#api-rest-api-3-user-get
        endpoint: `/ex/jira/${cloudId}/rest/api/3/user`,
        params,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `User with account ID "${input['accountId']}" not found`,
        });
      }

      const providerUser = ProviderUserSchema.parse(response.data);

      return {
        accountId: providerUser.accountId,
        ...(providerUser.accountType !== undefined && { accountType: providerUser.accountType }),
        ...(providerUser.emailAddress !== undefined && { emailAddress: providerUser.emailAddress }),
        ...(providerUser.displayName !== undefined && { displayName: providerUser.displayName }),
        ...(providerUser.active !== undefined && { active: providerUser.active }),
        ...(providerUser.timeZone !== undefined && { timeZone: providerUser.timeZone }),
        ...(providerUser.locale !== undefined && { locale: providerUser.locale }),
        ...(providerUser.avatarUrls !== undefined && { avatarUrls: providerUser.avatarUrls }),
        ...(providerUser.groups?.items !== undefined && {
          groups: providerUser.groups.items,
        }),
        ...(providerUser.applicationRoles?.items !== undefined && {
          applicationRoles: providerUser.applicationRoles.items,
        }),
      };
    },
  });
}
