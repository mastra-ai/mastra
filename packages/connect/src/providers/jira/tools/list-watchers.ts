// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listWatchersInputSchema = z.object({
  issueIdOrKey: z.string().describe('The ID or key of the issue. Example: "10001" or "PROJ-123"'),
});

const WatcherSchema = z.object({
  accountId: z.string(),
  accountType: z.string().optional(),
  active: z.boolean(),
  avatarUrls: z.record(z.string(), z.string()).optional(),
  displayName: z.string(),
  emailAddress: z.string().optional(),
  key: z.string().optional(),
  name: z.string().optional(),
  self: z.string(),
});

const ProviderWatchersSchema = z.object({
  isWatching: z.boolean(),
  self: z.string(),
  watchCount: z.number(),
  watchers: z.array(WatcherSchema),
});

export const listWatchersOutputSchema = z.object({
  isWatching: z.boolean(),
  watchCount: z.number(),
  watchers: z.array(
    z.object({
      accountId: z.string(),
      accountType: z.string().optional(),
      active: z.boolean(),
      avatarUrls: z.record(z.string(), z.string()).optional(),
      displayName: z.string(),
      emailAddress: z.string().optional(),
      self: z.string(),
    }),
  ),
});

export function listWatchersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_list_watchers',
    description: 'List watchers on a Jira issue',
    inputSchema: listWatchersInputSchema,
    outputSchema: listWatchersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listWatchersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Get connection to access cloudId from connection_config
      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/#authentication
      const connection = await platformProxy.getConnection();
      let cloudId = connection.connection_config?.['cloudId'];

      // Fallback to metadata if not in connection_config
      if (!cloudId) {
        const metadata = await platformProxy.getMetadata<{ cloudId?: string }>();
        cloudId = metadata?.cloudId;
      }

      if (!cloudId) {
        throw new platformProxy.ActionError({
          type: 'missing_cloud_id',
          message: 'cloudId is required in connection_config or metadata but was not found',
        });
      }

      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-watchers/#api-rest-api-3-issue-issueidorkey-watchers-get
      const response = await platformProxy.get({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/issue/${input.issueIdOrKey}/watchers`,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 3,
      });

      if (response.status === 404) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Issue not found',
          issueIdOrKey: input.issueIdOrKey,
        });
      }

      if (response.status === 403) {
        throw new platformProxy.ActionError({
          type: 'permission_denied',
          message: 'Permission denied to view watchers for this issue',
          issueIdOrKey: input.issueIdOrKey,
        });
      }

      const watchersData = ProviderWatchersSchema.parse(response.data);

      return {
        isWatching: watchersData.isWatching,
        watchCount: watchersData.watchCount,
        watchers: watchersData.watchers.map(watcher => ({
          accountId: watcher.accountId,
          ...(watcher.accountType !== undefined && { accountType: watcher.accountType }),
          active: watcher.active,
          ...(watcher.avatarUrls !== undefined && { avatarUrls: watcher.avatarUrls }),
          displayName: watcher.displayName,
          ...(watcher.emailAddress !== undefined && { emailAddress: watcher.emailAddress }),
          self: watcher.self,
        })),
      };
    },
  });
}
