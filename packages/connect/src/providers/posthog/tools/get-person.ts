// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getPersonInputSchema = z.object({
  project_id: z.number().describe('PostHog project ID. Example: 309484'),
  id: z.string().describe('Person ID (numeric ID or UUID). Example: "28326788283"'),
});

const ProviderPersonSchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  distinct_ids: z.array(z.string()),
  properties: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
  uuid: z.string(),
  last_seen_at: z.string().nullable(),
});

export const getPersonOutputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  distinct_ids: z.array(z.string()),
  properties: z.record(z.string(), z.unknown()).optional(),
  created_at: z.string(),
  uuid: z.string(),
  last_seen_at: z.string().optional(),
});

export function getPersonTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_get_person',
    description: 'Retrieve a single person from PostHog.',
    inputSchema: getPersonInputSchema,
    outputSchema: getPersonOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getPersonOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://posthog.com/docs/api/persons
        endpoint: `/api/projects/${encodeURIComponent(String(input.project_id))}/persons/${encodeURIComponent(input.id)}/`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Person not found',
          person_id: input.id,
        });
      }

      const providerPerson = ProviderPersonSchema.parse(response.data);

      return {
        id: providerPerson.id,
        ...(providerPerson.name != null && { name: providerPerson.name }),
        distinct_ids: providerPerson.distinct_ids,
        ...(providerPerson.properties != null && { properties: providerPerson.properties }),
        created_at: providerPerson.created_at,
        uuid: providerPerson.uuid,
        ...(providerPerson.last_seen_at != null && { last_seen_at: providerPerson.last_seen_at }),
      };
    },
  });
}
