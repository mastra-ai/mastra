// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateWorklogInputSchema = z.object({
  issueIdOrKey: z.string().describe('The ID or key of the issue. Example: "10002" or "PROJ-123"'),
  worklogId: z.string().describe('The ID of the worklog to update. Example: "100028"'),
  timeSpent: z.string().optional().describe('A string representing the time spent. Example: "3h 20m"'),
  timeSpentSeconds: z.number().optional().describe('The time spent in seconds. Example: 12000'),
  comment: z
    .string()
    .optional()
    .describe(
      'A comment about the worklog as a plain text string. This will be converted to Atlassian Document Format.',
    ),
  started: z
    .string()
    .optional()
    .describe('The datetime when the work was started in ISO 8601 format. Example: "2021-01-17T12:34:00.000+0000"'),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
  baseUrl: z.string().optional(),
});

const VisibilitySchema = z.object({
  identifier: z.string().optional(),
  type: z.string().optional(),
  value: z.string().optional(),
});

const UserSchema = z.object({
  accountId: z.string().optional(),
  accountType: z.string().optional(),
  active: z.boolean().optional(),
  displayName: z.string().optional(),
  emailAddress: z.string().optional(),
  key: z.string().optional(),
  name: z.string().optional(),
  self: z.string().optional(),
  timeZone: z.string().optional(),
  avatarUrls: z
    .object({
      '16x16': z.string().optional(),
      '24x24': z.string().optional(),
      '32x32': z.string().optional(),
      '48x48': z.string().optional(),
    })
    .optional(),
});

const ProviderWorklogSchema = z.object({
  id: z.string(),
  issueId: z.string().optional(),
  self: z.string().optional(),
  author: UserSchema.optional(),
  updateAuthor: UserSchema.optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
  started: z.string().optional(),
  timeSpent: z.string().optional(),
  timeSpentSeconds: z.number().optional(),
  comment: z.unknown().optional(),
  visibility: VisibilitySchema.optional(),
  properties: z.array(z.unknown()).optional(),
});

export const updateWorklogOutputSchema = z.object({
  id: z.string(),
  issueId: z.string().optional(),
  self: z.string().optional(),
  author: z
    .object({
      accountId: z.string().optional(),
      displayName: z.string().optional(),
      emailAddress: z.string().optional(),
    })
    .optional(),
  updateAuthor: z
    .object({
      accountId: z.string().optional(),
      displayName: z.string().optional(),
      emailAddress: z.string().optional(),
    })
    .optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
  started: z.string().optional(),
  timeSpent: z.string().optional(),
  timeSpentSeconds: z.number().optional(),
  visibility: z
    .object({
      type: z.string().optional(),
      value: z.string().optional(),
    })
    .optional(),
});

async function executeUpdateWorklog(
  platformProxy: PlatformProxy,
  input: z.infer<typeof updateWorklogInputSchema>,
  cloudId: string,
): Promise<z.infer<typeof updateWorklogOutputSchema>> {
  // Build request body with only provided fields
  const requestBody: Record<string, unknown> = {};

  if (input.timeSpent !== undefined) {
    requestBody['timeSpent'] = input.timeSpent;
  }

  if (input.timeSpentSeconds !== undefined) {
    requestBody['timeSpentSeconds'] = input.timeSpentSeconds;
  }

  if (input.comment !== undefined) {
    // Convert plain text comment to Atlassian Document Format
    requestBody['comment'] = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: input.comment,
            },
          ],
        },
      ],
    };
  }

  if (input.started !== undefined) {
    requestBody['started'] = input.started;
  }

  // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-worklogs/#api-rest-api-3-issue-issueidorkey-worklog-id-put
  const response = await platformProxy.put({
    endpoint: `/ex/jira/${cloudId}/rest/api/3/issue/${input.issueIdOrKey}/worklog/${input.worklogId}`,
    headers: {
      'X-Atlassian-Token': 'no-check',
    },
    data: requestBody,
    retries: 10,
  });

  if (!response.data) {
    throw new platformProxy.ActionError({
      type: 'worklog_not_found',
      message: `Worklog ${input.worklogId} not found on issue ${input.issueIdOrKey}.`,
    });
  }

  const worklog = ProviderWorklogSchema.parse(response.data);

  return {
    id: worklog.id,
    issueId: worklog.issueId,
    self: worklog.self,
    author: worklog.author
      ? {
          accountId: worklog.author.accountId,
          displayName: worklog.author.displayName,
          emailAddress: worklog.author.emailAddress,
        }
      : undefined,
    updateAuthor: worklog.updateAuthor
      ? {
          accountId: worklog.updateAuthor.accountId,
          displayName: worklog.updateAuthor.displayName,
          emailAddress: worklog.updateAuthor.emailAddress,
        }
      : undefined,
    created: worklog.created,
    updated: worklog.updated,
    started: worklog.started,
    timeSpent: worklog.timeSpent,
    timeSpentSeconds: worklog.timeSpentSeconds,
    visibility: worklog.visibility
      ? {
          type: worklog.visibility.type,
          value: worklog.visibility.value,
        }
      : undefined,
  };
}

export function updateWorklogTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_update_worklog',
    description: 'Update a worklog on a Jira issue.',
    inputSchema: updateWorklogInputSchema,
    outputSchema: updateWorklogOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateWorklogOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Resolve cloudId for Jira Cloud API
      const connection = await platformProxy.getConnection();
      const cloudId = connection.connection_config?.['cloudId'];
      const baseUrl = connection.connection_config?.['baseUrl'];

      if (!cloudId || !baseUrl) {
        const metadata = await platformProxy.getMetadata<{
          cloudId?: string;
          baseUrl?: string;
        }>();

        if (!metadata?.cloudId || !metadata?.baseUrl) {
          // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-other-operations/#api-rest-api-3-serverinfo-get
          const response = await platformProxy.get({
            endpoint: '/oauth/token/accessible-resources',
            baseUrlOverride: 'https://api.atlassian.com',
            retries: 3,
          });

          if (!response.data?.[0]) {
            throw new platformProxy.ActionError({
              type: 'missing_cloud_id',
              message: 'Could not resolve Jira cloud ID from accessible resources.',
            });
          }

          const resolvedCloudId = response.data[0].id;
          const resolvedBaseUrl = response.data[0].url;

          const metadataToUpdate: { cloudId: string; baseUrl: string } = {
            cloudId: resolvedCloudId,
            baseUrl: resolvedBaseUrl,
          };
          await platformProxy.updateMetadata(metadataToUpdate);

          return executeUpdateWorklog(platformProxy, input, resolvedCloudId);
        }

        return executeUpdateWorklog(platformProxy, input, metadata.cloudId);
      }

      return executeUpdateWorklog(platformProxy, input, cloudId);
    },
  });
}
