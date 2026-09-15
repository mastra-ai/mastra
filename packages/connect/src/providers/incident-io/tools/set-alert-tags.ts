// AUTO-GENERATED from rhysbalevicius/integration-templates @ b5c56f19353e — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const setAlertTagsInputSchema = z
  .object({ id: z.string(), body: z.object({ tags: z.array(z.string()).max(25) }).passthrough() })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    alert: z
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
  })
  .passthrough();

export const setAlertTagsOutputSchema = ProviderResponseSchema;

export function setAlertTagsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_set_alert_tags',
    description: 'Set alert tags in incident.io.',
    inputSchema: setAlertTagsInputSchema,
    outputSchema: setAlertTagsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof setAlertTagsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/alerts/${encodeURIComponent(input['id'])}/actions/set_tags`,
        retries: 0,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
