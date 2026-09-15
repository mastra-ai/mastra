// AUTO-GENERATED from rhysbalevicius/integration-templates @ b5c56f19353e — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listSchedulesInputSchema = z
  .object({ page_size: z.number().int().min(1).max(250).optional(), after: z.string().optional() })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    pagination_meta: z
      .object({
        after: z.string().optional(),
        page_size: z.number().int().max(250),
        total_record_count: z.number().int().optional(),
      })
      .passthrough()
      .optional(),
    schedules: z.array(
      z
        .object({
          annotations: z.record(z.string(), z.string()),
          config: z
            .object({
              rotations: z.array(
                z
                  .object({
                    effective_from: z.string().optional(),
                    handover_start_at: z.string(),
                    handovers: z.array(
                      z
                        .object({ interval: z.number().int(), interval_type: z.enum(['hourly', 'daily', 'weekly']) })
                        .passthrough(),
                    ),
                    id: z.string(),
                    layers: z.array(z.object({ id: z.string().optional(), name: z.string().optional() }).passthrough()),
                    name: z.string(),
                    scheduling_mode: z.enum(['fair', 'sequential']).optional(),
                    users: z.array(
                      z
                        .object({
                          email: z.string().optional(),
                          id: z.string(),
                          name: z.string(),
                          role: z.enum(['viewer', 'responder', 'administrator', 'owner', 'unset']),
                          slack_user_id: z.string().optional(),
                        })
                        .passthrough(),
                    ),
                    working_interval: z
                      .array(
                        z
                          .object({
                            end_time: z.string(),
                            start_time: z.string(),
                            weekday: z.enum([
                              'monday',
                              'tuesday',
                              'wednesday',
                              'thursday',
                              'friday',
                              'saturday',
                              'sunday',
                            ]),
                          })
                          .passthrough(),
                      )
                      .optional(),
                    working_intervals: z.array(
                      z
                        .object({
                          end_time: z.string(),
                          start_time: z.string(),
                          weekday: z.enum([
                            'monday',
                            'tuesday',
                            'wednesday',
                            'thursday',
                            'friday',
                            'saturday',
                            'sunday',
                          ]),
                        })
                        .passthrough(),
                    ),
                  })
                  .passthrough(),
              ),
            })
            .passthrough()
            .optional(),
          created_at: z.string(),
          current_shifts: z
            .array(
              z
                .object({
                  end_at: z.string(),
                  entry_id: z.string().optional(),
                  fingerprint: z.string().optional(),
                  layer_id: z.string().optional(),
                  rotation_id: z.string().optional(),
                  start_at: z.string(),
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
                })
                .passthrough(),
            )
            .optional(),
          holidays_public_config: z
            .object({ country_codes: z.array(z.string()) })
            .passthrough()
            .optional(),
          id: z.string(),
          name: z.string(),
          next_shifts: z
            .array(
              z
                .object({
                  end_at: z.string(),
                  entry_id: z.string().optional(),
                  fingerprint: z.string().optional(),
                  layer_id: z.string().optional(),
                  rotation_id: z.string().optional(),
                  start_at: z.string(),
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
                })
                .passthrough(),
            )
            .optional(),
          permalink: z.string(),
          team_ids: z.array(z.string()),
          timezone: z.string(),
          updated_at: z.string(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const listSchedulesOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listSchedulesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_schedules',
    description: 'List schedules in incident.io. Returns one page; pass next_cursor as after to continue.',
    inputSchema: listSchedulesInputSchema,
    outputSchema: listSchedulesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSchedulesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['page_size'] !== undefined)
        params['page_size'] = Array.isArray(input['page_size'])
          ? input['page_size'].join(',')
          : String(input['page_size']);
      if (input['after'] !== undefined)
        params['after'] = Array.isArray(input['after']) ? input['after'].join(',') : String(input['after']);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/schedules`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.pagination_meta?.after || undefined };
    },
  });
}
