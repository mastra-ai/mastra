// AUTO-GENERATED from rhysbalevicius/integration-templates @ 3ad35d4bf046 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listScheduleEntriesInputSchema = z
  .object({
    schedule_id: z.string(),
    entry_window_start: z.string().optional(),
    entry_window_end: z.string().optional(),
  })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    pagination_meta: z.object({ after: z.string(), after_url: z.string() }).passthrough().optional(),
    schedule_entries: z
      .object({
        final: z.array(
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
        ),
        overrides: z.array(
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
        ),
        scheduled: z.array(
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
        ),
      })
      .passthrough(),
  })
  .passthrough();

export const listScheduleEntriesOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listScheduleEntriesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_schedule_entries',
    description: 'List schedule entries in incident.io. Returns one page; pass next_cursor as after to continue.',
    inputSchema: listScheduleEntriesInputSchema,
    outputSchema: listScheduleEntriesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listScheduleEntriesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['schedule_id'] !== undefined)
        params['schedule_id'] = Array.isArray(input['schedule_id'])
          ? input['schedule_id'].join(',')
          : String(input['schedule_id']);
      if (input['entry_window_start'] !== undefined)
        params['entry_window_start'] = Array.isArray(input['entry_window_start'])
          ? input['entry_window_start'].join(',')
          : String(input['entry_window_start']);
      if (input['entry_window_end'] !== undefined)
        params['entry_window_end'] = Array.isArray(input['entry_window_end'])
          ? input['entry_window_end'].join(',')
          : String(input['entry_window_end']);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/schedule_entries`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.pagination_meta?.after || undefined };
    },
  });
}
