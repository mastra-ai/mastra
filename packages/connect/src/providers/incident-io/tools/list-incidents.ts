// AUTO-GENERATED from rhysbalevicius/integration-templates @ cfb727cbc131 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listIncidentsInputSchema = z.object({
  page_size: z.number().int().min(1).max(500).optional(),
  after: z.string().optional(),
  sort_by: z.enum(['created_at_newest_first', 'created_at_oldest_first']).optional(),
  filter_mode: z.enum(['all', 'any']).optional(),
});

const ProviderResponseSchema = z
  .object({
    incidents: z.array(
      z
        .object({
          call_url: z.string().optional(),
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
          custom_field_entries: z.array(
            z
              .object({
                custom_field: z
                  .object({
                    description: z.string(),
                    field_type: z.enum(['single_select', 'multi_select', 'text', 'link', 'numeric']),
                    id: z.string(),
                    name: z.string().max(50),
                    options: z.array(
                      z
                        .object({
                          custom_field_id: z.string(),
                          id: z.string(),
                          sort_key: z.number().int(),
                          value: z.string(),
                        })
                        .passthrough(),
                    ),
                  })
                  .passthrough(),
                values: z.array(
                  z
                    .object({
                      value_catalog_entry: z
                        .object({
                          aliases: z.array(z.string()).optional(),
                          external_id: z.string().optional(),
                          id: z.string(),
                          name: z.string(),
                        })
                        .passthrough()
                        .optional(),
                      value_link: z.string().optional(),
                      value_numeric: z.string().optional(),
                      value_option: z
                        .object({
                          custom_field_id: z.string(),
                          id: z.string(),
                          sort_key: z.number().int(),
                          value: z.string(),
                        })
                        .passthrough()
                        .optional(),
                      value_text: z.string().optional(),
                    })
                    .passthrough(),
                ),
              })
              .passthrough(),
          ),
          duration_metrics: z
            .array(
              z
                .object({
                  duration_metric: z.object({ id: z.string(), name: z.string() }).passthrough(),
                  status: z.enum(['success', 'timestamps_missing', 'calculating', 'invalid_timestamps']),
                  value_seconds: z.number().int().optional(),
                })
                .passthrough(),
            )
            .optional(),
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
            .optional(),
          has_debrief: z.boolean().optional(),
          id: z.string(),
          incident_role_assignments: z.array(
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
                  .optional(),
                role: z
                  .object({
                    created_at: z.string(),
                    description: z.string().min(1),
                    id: z.string(),
                    instructions: z.string(),
                    name: z.string().min(1),
                    required: z.boolean().optional(),
                    role_type: z.enum(['lead', 'reporter', 'custom']),
                    shortform: z.string(),
                    updated_at: z.string(),
                  })
                  .passthrough(),
              })
              .passthrough(),
          ),
          incident_status: z
            .object({
              category: z.enum(['triage', 'declined', 'merged', 'canceled', 'live', 'learning', 'closed', 'paused']),
              created_at: z.string(),
              description: z.string(),
              id: z.string(),
              name: z.string(),
              rank: z.number().int(),
              updated_at: z.string(),
            })
            .passthrough(),
          incident_timestamp_values: z
            .array(
              z
                .object({
                  incident_timestamp: z
                    .object({ id: z.string(), name: z.string(), rank: z.number().int() })
                    .passthrough(),
                  value: z.object({ value: z.string().optional() }).passthrough().optional(),
                })
                .passthrough(),
            )
            .optional(),
          incident_type: z
            .object({
              create_in_triage: z.enum(['always', 'optional']),
              created_at: z.string(),
              description: z.string(),
              id: z.string(),
              is_default: z.boolean(),
              name: z.string(),
              private_incidents_only: z.boolean(),
              updated_at: z.string(),
            })
            .passthrough()
            .optional(),
          last_activity_at: z.string(),
          mode: z.enum(['standard', 'retrospective', 'test', 'tutorial']),
          ms_teams_channel_url: z.string().optional(),
          name: z.string(),
          permalink: z.string().optional(),
          postmortem_document_ids: z.array(z.string()).optional(),
          postmortem_document_url: z.string().optional(),
          reference: z.string(),
          severity: z
            .object({
              created_at: z.string(),
              description: z.string(),
              id: z.string(),
              name: z.string().max(50),
              rank: z.number().int(),
              updated_at: z.string(),
            })
            .passthrough()
            .optional(),
          slack_channel_id: z.string(),
          slack_channel_name: z.string().optional(),
          slack_channel_url: z.string().optional(),
          slack_team_id: z.string(),
          summary: z.string().optional(),
          team_ids: z.array(z.string()),
          updated_at: z.string(),
          visibility: z.enum(['public', 'private']),
          workload_minutes_late: z.number().optional(),
          workload_minutes_sleeping: z.number().optional(),
          workload_minutes_total: z.number().optional(),
          workload_minutes_working: z.number().optional(),
        })
        .passthrough(),
    ),
    pagination_meta: z
      .object({
        after: z.string().optional(),
        page_size: z.number().int().max(250),
        total_record_count: z.number().int().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const listIncidentsOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listIncidentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_incidents',
    description: 'List incidents in incident.io. Returns one page; pass next_cursor as after to continue.',
    inputSchema: listIncidentsInputSchema,
    outputSchema: listIncidentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listIncidentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};
      if (input['page_size'] !== undefined) params['page_size'] = input['page_size'];
      if (input['after'] !== undefined) params['after'] = input['after'];
      if (input['sort_by'] !== undefined) params['sort_by'] = input['sort_by'];
      if (input['filter_mode'] !== undefined) params['filter_mode'] = input['filter_mode'];
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/incidents`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.pagination_meta?.after || undefined };
    },
  });
}
