// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0a9bc570eb76 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const connectFollowUpExternalIssueInputSchema = z
  .object({
    id: z.string(),
    body: z
      .object({
        provider: z.enum([
          'asana',
          'azure_devops',
          'click_up',
          'freshservice',
          'linear',
          'jira',
          'salesforce',
          'jira_server',
          'github',
          'gitlab',
          'service_now',
          'shortcut',
          'notion',
        ]),
        url: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    follow_up: z
      .object({
        assignee: z
          .object({
            email: z.string().optional(),
            id: z.string(),
            name: z.string(),
            role: z.enum(['viewer', 'responder', 'administrator', 'owner', 'unset']),
            slack_user_id: z.string().optional(),
          })
          .passthrough()
          .nullable()
          .optional(),
        assignee_team: z.object({ id: z.string(), name: z.string() }).passthrough().nullable().optional(),
        category: z
          .object({ description: z.string().optional(), id: z.string(), name: z.string(), rank: z.number().int() })
          .passthrough()
          .nullable()
          .optional(),
        completed_at: z.string().optional(),
        created_at: z.string(),
        creator: z
          .object({
            alert: z.object({ id: z.string(), title: z.string() }).passthrough().optional(),
            api_key: z.object({ id: z.string(), name: z.string() }).passthrough().optional(),
            user: z
              .object({
                email: z.string().optional(),
                id: z.string(),
                name: z.string(),
                role: z.enum(['viewer', 'responder', 'administrator', 'owner', 'unset']),
                slack_user_id: z.string().optional(),
              })
              .passthrough()
              .optional(),
            workflow: z.object({ id: z.string(), name: z.string() }).passthrough().optional(),
          })
          .passthrough(),
        description: z.string().optional(),
        external_issue_reference: z
          .object({
            issue_name: z.string(),
            issue_permalink: z.string(),
            provider: z.enum([
              'asana',
              'azure_devops',
              'click_up',
              'freshservice',
              'linear',
              'jira',
              'salesforce',
              'jira_server',
              'github',
              'gitlab',
              'service_now',
              'shortcut',
              'notion',
            ]),
          })
          .passthrough()
          .nullable()
          .optional(),
        id: z.string(),
        incident_id: z.string(),
        labels: z.array(z.string()),
        priority: z
          .object({ description: z.string().optional(), id: z.string(), name: z.string(), rank: z.number().int() })
          .passthrough()
          .nullable()
          .optional(),
        status: z.enum(['outstanding', 'completed', 'deleted', 'not_doing']),
        title: z.string(),
        updated_at: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

export const connectFollowUpExternalIssueOutputSchema = ProviderResponseSchema;

export function connectFollowUpExternalIssueTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_connect_follow_up_external_issue',
    description: 'Connect a follow-up to an external issue in incident.io.',
    inputSchema: connectFollowUpExternalIssueInputSchema,
    outputSchema: connectFollowUpExternalIssueOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof connectFollowUpExternalIssueOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v3/follow_ups/${encodeURIComponent(input['id'])}/actions/connect_external_issue`,
        retries: 0,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
