// AUTO-GENERATED from rhysbalevicius/integration-templates @ c4fb0d5d5b2c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listIncidentParticipantsInputSchema = z.object({ incident_id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    incident_participants: z
      .object({
        active: z.array(
          z
            .object({
              participant_type: z.enum(['observer', 'collaborator', 'responder']).or(z.string()),
              user: z
                .object({
                  email: z.string().optional(),
                  id: z.string(),
                  name: z.string(),
                  role: z.enum(['viewer', 'responder', 'administrator', 'owner', 'unset']).or(z.string()),
                  slack_user_id: z.string().optional(),
                })
                .passthrough(),
            })
            .passthrough(),
        ),
        passive: z.array(
          z
            .object({
              participant_type: z.enum(['observer', 'collaborator', 'responder']).or(z.string()),
              user: z
                .object({
                  email: z.string().optional(),
                  id: z.string(),
                  name: z.string(),
                  role: z.enum(['viewer', 'responder', 'administrator', 'owner', 'unset']).or(z.string()),
                  slack_user_id: z.string().optional(),
                })
                .passthrough(),
            })
            .passthrough(),
        ),
      })
      .passthrough(),
  })
  .passthrough();

export const listIncidentParticipantsOutputSchema = ProviderResponseSchema;

export function listIncidentParticipantsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_incident_participants',
    description: 'List incident participants in incident.io.',
    inputSchema: listIncidentParticipantsInputSchema,
    outputSchema: listIncidentParticipantsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listIncidentParticipantsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['incident_id'] !== undefined) params['incident_id'] = String(input['incident_id']);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/incident_participants`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
