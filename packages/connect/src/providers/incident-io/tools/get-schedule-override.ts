// AUTO-GENERATED from rhysbalevicius/integration-templates @ c4fb0d5d5b2c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getScheduleOverrideInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    override: z
      .object({
        created_at: z.string(),
        end_at: z.string(),
        id: z.string(),
        layer_id: z.string(),
        rotation_id: z.string(),
        schedule_id: z.string(),
        start_at: z.string(),
        updated_at: z.string(),
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
  })
  .passthrough();

export const getScheduleOverrideOutputSchema = ProviderResponseSchema;

export function getScheduleOverrideTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_get_schedule_override',
    description: 'Get schedule override in incident.io.',
    inputSchema: getScheduleOverrideInputSchema,
    outputSchema: getScheduleOverrideOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getScheduleOverrideOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/schedule_overrides/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
