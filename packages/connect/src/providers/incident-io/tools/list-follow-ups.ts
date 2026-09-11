// AUTO-GENERATED from rhysbalevicius/integration-templates @ cfb727cbc131 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listFollowUpsInputSchema = z.object({
  page_size: z.number().int().min(1).max(250).optional(),
  after: z.string().optional(),
  incident_id: z.string().optional(),
  incident_mode: z.enum(['standard', 'retrospective', 'test', 'tutorial', 'stream']).optional(),
  assignee_team_id: z.string().optional(),
});

const ProviderResponseSchema = z
  .object({
    follow_ups: z.array(
      z
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
    ),
    pagination_meta: z.object({ after: z.string().optional(), page_size: z.number().int().max(250) }).passthrough(),
  })
  .passthrough();

export const listFollowUpsOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listFollowUpsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_follow_ups',
    description: 'List follow ups in incident.io. Returns one page; pass next_cursor as after to continue.',
    inputSchema: listFollowUpsInputSchema,
    outputSchema: listFollowUpsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listFollowUpsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};
      if (input['page_size'] !== undefined) params['page_size'] = input['page_size'];
      if (input['after'] !== undefined) params['after'] = input['after'];
      if (input['incident_id'] !== undefined) params['incident_id'] = input['incident_id'];
      if (input['incident_mode'] !== undefined) params['incident_mode'] = input['incident_mode'];
      if (input['assignee_team_id'] !== undefined) params['assignee_team_id'] = input['assignee_team_id'];
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v3/follow_ups`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.pagination_meta?.after || undefined };
    },
  });
}
