// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getIssueInputSchema = z.object({
  issueIdOrKey: z.string().describe('The ID or key of the issue to retrieve. Example: "10001" or "PROJ-123"'),
  fields: z
    .string()
    .optional()
    .describe('Comma-separated list of fields to return. Example: "summary,description,status"'),
  expand: z
    .string()
    .optional()
    .describe('Comma-separated list of fields to expand. Example: "renderedFields,names,schema"'),
  properties: z
    .string()
    .optional()
    .describe('Comma-separated list of issue property keys to return. Example: "property1,property2"'),
});

const IssueSchema = z
  .object({
    id: z.string(),
    key: z.string(),
    self: z.string(),
  })
  .passthrough();

export const getIssueOutputSchema = z
  .object({
    id: z.string().describe('The unique identifier of the issue'),
    key: z.string().describe('The issue key (e.g., "PROJ-123")'),
    self: z.string().describe('The REST API URL of the issue'),
  })
  .passthrough();

async function getCloudId(platformProxy: PlatformProxy): Promise<string> {
  const connection = await platformProxy.getConnection();

  let cloudId: string | undefined;

  if (connection.connection_config && typeof connection.connection_config === 'object') {
    const config = connection.connection_config;
    if ('cloudId' in config && typeof config['cloudId'] === 'string') {
      cloudId = config['cloudId'];
    }
  }

  if (!cloudId) {
    const metadata = await platformProxy.getMetadata<{ cloudId?: string }>();
    cloudId = metadata?.cloudId;
  }

  if (!cloudId) {
    // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-myself/#api-rest-api-3-myself-get
    const response = await platformProxy.get({
      endpoint: 'oauth/token/accessible-resources',
      retries: 3,
    });

    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      const resource = response.data[0];
      cloudId = resource['id'];
    }
  }

  if (!cloudId) {
    throw new platformProxy.ActionError({
      type: 'missing_cloud_id',
      message: 'Could not determine Jira cloud ID. Please verify the connection is properly configured.',
    });
  }

  return cloudId;
}

export function getIssueTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_get_issue',
    description: 'Retrieve a Jira issue by ID or key',
    inputSchema: getIssueInputSchema,
    outputSchema: getIssueOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getIssueOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const cloudId = await getCloudId(platformProxy);

      const params: Record<string, string> = {};
      if (input.fields !== undefined) {
        params['fields'] = input.fields;
      }
      if (input.expand !== undefined) {
        params['expand'] = input.expand;
      }
      if (input.properties !== undefined) {
        params['properties'] = input.properties;
      }

      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-issueidorkey-get
      const response = await platformProxy.get({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/issue/${input.issueIdOrKey}`,
        params: params,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Issue not found: ${input.issueIdOrKey}`,
          issueIdOrKey: input.issueIdOrKey,
        });
      }

      const issue = IssueSchema.parse(response.data);

      return issue;
    },
  });
}
