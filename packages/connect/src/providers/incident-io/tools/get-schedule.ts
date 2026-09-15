// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0a9bc570eb76 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getScheduleInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    schedule: z
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
                      .object({
                        interval: z.number().int(),
                        interval_type: z.enum(['hourly', 'daily', 'weekly']).or(z.string()),
                      })
                      .passthrough(),
                  ),
                  id: z.string(),
                  layers: z.array(z.object({ id: z.string().optional(), name: z.string().optional() }).passthrough()),
                  name: z.string(),
                  scheduling_mode: z.enum(['fair', 'sequential']).or(z.string()).optional(),
                  users: z.array(
                    z
                      .object({
                        email: z.string().optional(),
                        id: z.string(),
                        name: z.string(),
                        role: z.enum(['viewer', 'responder', 'administrator', 'owner', 'unset']).or(z.string()),
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
                          weekday: z
                            .enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
                            .or(z.string()),
                        })
                        .passthrough(),
                    )
                    .optional(),
                  working_intervals: z.array(
                    z
                      .object({
                        end_time: z.string(),
                        start_time: z.string(),
                        weekday: z
                          .enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
                          .or(z.string()),
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
                    role: z.enum(['viewer', 'responder', 'administrator', 'owner', 'unset']).or(z.string()),
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
                    role: z.enum(['viewer', 'responder', 'administrator', 'owner', 'unset']).or(z.string()),
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
  })
  .passthrough();

export const getScheduleOutputSchema = ProviderResponseSchema;

export function getScheduleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_get_schedule',
    description: 'Get schedule in incident.io.',
    inputSchema: getScheduleInputSchema,
    outputSchema: getScheduleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getScheduleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/schedules/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
