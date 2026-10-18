// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getIssueChangelogInputSchema = z.object({
  issueIdOrKey: z.string(),
  startAt: z.number().optional(),
  maxResults: z.number().optional(),
});

const ChangelogItemSchema = z.object({
  field: z.string().optional(),
  fieldtype: z.string().optional(),
  fieldId: z.string().optional(),
  from: z.string().nullable().optional(),
  fromString: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
  toString: z.string().nullable().optional(),
});

const HistorySchema = z.object({
  id: z.string(),
  author: z
    .object({
      self: z.string().optional(),
      accountId: z.string().optional(),
      accountType: z.string().optional(),
      displayName: z.string().optional(),
      avatarUrls: z.record(z.string(), z.string()).optional(),
    })
    .passthrough()
    .optional(),
  created: z.string(),
  items: z.array(ChangelogItemSchema),
  historyMetadata: z.record(z.string(), z.unknown()).optional(),
});

export const getIssueChangelogOutputSchema = z.object({
  changelog: z.array(HistorySchema),
  startAt: z.number().optional(),
  maxResults: z.number().optional(),
  total: z.number().optional(),
  isLast: z.boolean().optional(),
});

export function getIssueChangelogTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_get_issue_changelog',
    description: 'Retrieve the changelog for a Jira issue',
    inputSchema: getIssueChangelogInputSchema,
    outputSchema: getIssueChangelogOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getIssueChangelogOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Get cloudId from connection config or metadata
      const connection = await platformProxy.getConnection();
      let cloudId: string | undefined;

      // Try connection_config first
      if (connection.connection_config && typeof connection.connection_config === 'object') {
        cloudId = connection.connection_config['cloudId'];
      }

      // Fall back to metadata if not found in connection_config
      if (!cloudId) {
        const metadata = await platformProxy.getMetadata<{ cloudId?: string }>();
        cloudId = metadata?.cloudId;
      }

      if (!cloudId || typeof cloudId !== 'string') {
        throw new platformProxy.ActionError({
          type: 'missing_cloud_id',
          message: 'cloudId is required in connection config or metadata. Please reconnect your Jira integration.',
        });
      }

      // Build pagination params
      const params: Record<string, string | number> = {};
      if (input['startAt'] !== undefined) {
        params['startAt'] = input['startAt'];
      }
      if (input['maxResults'] !== undefined) {
        params['maxResults'] = input['maxResults'];
      }

      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-changelog/#api-rest-api-3-issue-issueidorkey-changelog-get
      const response = await platformProxy.get({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/issue/${input.issueIdOrKey}/changelog`,
        params: params,
        retries: 3,
      });

      const changelogData = z
        .object({
          values: z.array(HistorySchema),
          startAt: z.number().optional(),
          maxResults: z.number().optional(),
          total: z.number().optional(),
          isLast: z.boolean().optional(),
        })
        .parse(response.data);

      return {
        changelog: changelogData.values,
        ...(changelogData.startAt !== undefined && { startAt: changelogData.startAt }),
        ...(changelogData.maxResults !== undefined && { maxResults: changelogData.maxResults }),
        ...(changelogData.total !== undefined && { total: changelogData.total }),
        ...(changelogData.isLast !== undefined && { isLast: changelogData.isLast }),
      };
    },
  });
}
