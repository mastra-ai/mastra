// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listUsersInputSchema = z.object({
  query: z
    .string()
    .describe(
      'A query string used to search user attributes. Matches against users visible to the authenticated account.',
    ),
  accountId: z
    .string()
    .optional()
    .describe('A users accountId to filter the search results. Example: "5b10a2844c20165700ede21g"'),
  startAt: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('The index of the first item to return in the results. Default: 0'),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe('The maximum number of items to return. Default: 50, Maximum: 1000'),
});

const AvatarUrlsSchema = z.object({
  '16x16': z.string().optional(),
  '24x24': z.string().optional(),
  '32x32': z.string().optional(),
  '48x48': z.string().optional(),
});

const UserSchema = z.object({
  accountId: z.string(),
  accountType: z.string().optional(),
  active: z.boolean().optional(),
  displayName: z.string().optional(),
  emailAddress: z.string().optional(),
  avatarUrls: AvatarUrlsSchema.optional(),
  timeZone: z.string().optional(),
  self: z.string().optional(),
});

export const listUsersOutputSchema = z.object({
  users: z.array(UserSchema),
  nextStartAt: z.number().int().optional(),
});

const AccessibleResourceSchema = z.object({
  id: z.string(),
  url: z.string(),
  name: z.string().optional(),
});

async function resolveCloudId(platformProxy: PlatformProxy): Promise<{ cloudId: string; baseUrl: string }> {
  const connection = await platformProxy.getConnection();

  const connectionConfig = connection.connection_config;
  const connectionConfigCloudId = connectionConfig?.['cloudId'];
  const connectionConfigBaseUrl = connectionConfig?.['baseUrl'];

  if (
    typeof connectionConfigCloudId === 'string' &&
    typeof connectionConfigBaseUrl === 'string' &&
    connectionConfigCloudId.length > 0 &&
    connectionConfigBaseUrl.length > 0
  ) {
    return { cloudId: connectionConfigCloudId, baseUrl: connectionConfigBaseUrl };
  }

  const metadata = await platformProxy.getMetadata();
  const metadataCloudId = metadata?.cloudId;
  const metadataBaseUrl = metadata?.baseUrl;

  if (
    typeof metadataCloudId === 'string' &&
    typeof metadataBaseUrl === 'string' &&
    metadataCloudId.length > 0 &&
    metadataBaseUrl.length > 0
  ) {
    return { cloudId: metadataCloudId, baseUrl: metadataBaseUrl };
  }

  // https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/#accessing-resources
  const response = await platformProxy.get({
    endpoint: 'oauth/token/accessible-resources',
    retries: 3,
  });

  const resources = z.array(AccessibleResourceSchema).parse(response.data);

  if (resources.length === 0 || resources[0] === undefined) {
    throw new platformProxy.ActionError({
      type: 'no_accessible_resources',
      message: 'No accessible Jira resources found for this connection.',
    });
  }

  const firstResource = resources[0];
  const cloudId = firstResource.id;
  const baseUrl = firstResource.url;

  // @allowTryCatch - Metadata update is best-effort caching to skip future calls; failures should not block the action
  try {
    await platformProxy.updateMetadata({ cloudId: cloudId, baseUrl: baseUrl });
  } catch {
    // Continue even if metadata update fails
  }

  return { cloudId: cloudId, baseUrl: baseUrl };
}

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
  baseUrl: z.string().optional(),
});

export function listUsersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_list_users',
    description: 'Search Jira users visible to the authenticated account.',
    inputSchema: listUsersInputSchema,
    outputSchema: listUsersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listUsersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const { cloudId } = await resolveCloudId(platformProxy);

      const params: Record<string, string | number> = {
        query: input['query'],
      };

      if (input['accountId'] !== undefined && input['accountId'].length > 0) {
        params['accountId'] = input['accountId'];
      }

      if (input['startAt'] !== undefined) {
        params['startAt'] = input['startAt'];
      }

      if (input['maxResults'] !== undefined) {
        params['maxResults'] = input['maxResults'];
      }

      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-user-search/#api-rest-api-3-user-search-get
      const response = await platformProxy.get({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/user/search`,
        params: params,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 3,
      });

      const users = z.array(UserSchema).parse(response.data);

      let nextStartAt: number | undefined;

      if (input['maxResults'] !== undefined && users.length === input['maxResults']) {
        nextStartAt = (input['startAt'] || 0) + users.length;
      }

      return {
        users: users,
        ...(nextStartAt !== undefined && { nextStartAt: nextStartAt }),
      };
    },
  });
}
