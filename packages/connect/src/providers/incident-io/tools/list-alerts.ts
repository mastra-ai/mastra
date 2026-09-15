// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0a9bc570eb76 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listAlertsInputSchema = z
  .object({ page_size: z.number().int().min(1).max(50).optional(), after: z.string().optional() })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    alerts: z.array(
      z
        .object({
          alert_group_ids: z.array(z.string()).optional(),
          alert_source_id: z.string(),
          attributes: z.array(
            z
              .object({
                array_value: z
                  .array(
                    z
                      .object({
                        catalog_entry: z
                          .object({ catalog_type_id: z.string(), id: z.string(), name: z.string() })
                          .passthrough()
                          .optional(),
                        label: z.string().optional(),
                        literal: z.string().optional(),
                      })
                      .passthrough(),
                  )
                  .optional(),
                attribute: z
                  .object({
                    array: z.boolean(),
                    emoji: z.string().optional(),
                    id: z.string(),
                    name: z.string(),
                    required: z.boolean(),
                    type: z.string(),
                  })
                  .passthrough(),
                value: z
                  .object({
                    catalog_entry: z
                      .object({ catalog_type_id: z.string(), id: z.string(), name: z.string() })
                      .passthrough()
                      .optional(),
                    label: z.string().optional(),
                    literal: z.string().optional(),
                  })
                  .passthrough()
                  .optional(),
              })
              .passthrough(),
          ),
          created_at: z.string(),
          deduplication_key: z.string(),
          description: z.string().optional(),
          id: z.string(),
          resolved_at: z.string().optional(),
          source_url: z.string().optional(),
          status: z.enum(['firing', 'resolved']),
          tags: z.array(z.object({ id: z.string(), name: z.string() }).passthrough()).optional(),
          title: z.string(),
          updated_at: z.string(),
        })
        .passthrough(),
    ),
    pagination_meta: z.object({ after: z.string().optional(), page_size: z.number().int().max(250) }).passthrough(),
  })
  .passthrough();

export const listAlertsOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listAlertsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_alerts',
    description: 'List alerts in incident.io. Returns one page; pass next_cursor as after to continue.',
    inputSchema: listAlertsInputSchema,
    outputSchema: listAlertsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listAlertsOutputSchema>> => {
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
        endpoint: `/v2/alerts`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.pagination_meta?.after || undefined };
    },
  });
}
