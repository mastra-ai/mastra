// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createPersonInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  distinct_id: z.string().describe('Distinct ID for the person. Example: "user_123"'),
  properties: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Person properties to set. Example: {"email": "user@example.com"}'),
});

const ProviderPersonSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  distinct_ids: z.array(z.string()),
  properties: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string().nullable(),
  uuid: z.string().nullable(),
  last_seen_at: z.string().nullable(),
});

const ProviderPersonListSchema = z.object({
  results: z.array(ProviderPersonSchema),
});

export const createPersonOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  distinct_ids: z.array(z.string()),
  properties: z.record(z.string(), z.unknown()).optional(),
  created_at: z.string().optional(),
  uuid: z.string().optional(),
  last_seen_at: z.string().optional(),
});

export function createPersonTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_create_person',
    description: 'Create a person in PostHog.',
    inputSchema: createPersonInputSchema,
    outputSchema: createPersonOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createPersonOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      const projectResponse = await platformProxy.get({
        // https://posthog.com/docs/api/projects
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/`,
        retries: 3,
      });

      const projectData =
        projectResponse.data !== null && typeof projectResponse.data === 'object' ? projectResponse.data : {};
      const apiKey =
        'api_token' in projectData && typeof projectData['api_token'] === 'string'
          ? projectData['api_token']
          : undefined;

      if (!apiKey) {
        throw new platformProxy.ActionError({
          type: 'missing_api_key',
          message: 'Project api_token not found in project details.',
        });
      }

      await platformProxy.post({
        // https://posthog.com/docs/api/capture
        endpoint: '/capture/',
        data: {
          api_key: apiKey,
          distinct_id: input.distinct_id,
          event: '$identify',
          properties: {
            ...(input.properties !== undefined && { $set: input.properties }),
          },
        },
        retries: 10,
      });

      const personResponse = await platformProxy.get({
        // https://posthog.com/docs/api/persons
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/persons/`,
        params: {
          distinct_id: input.distinct_id,
        },
        retries: 3,
      });

      const personList = ProviderPersonListSchema.parse(personResponse.data);
      const providerPerson = personList.results[0];

      if (!providerPerson) {
        throw new platformProxy.ActionError({
          type: 'person_not_found',
          message: 'Person was sent for creation but is not yet queryable. Please retry shortly.',
          distinct_id: input.distinct_id,
        });
      }

      return {
        id: providerPerson.id,
        ...(providerPerson.name != null && { name: providerPerson.name }),
        distinct_ids: providerPerson.distinct_ids,
        ...(providerPerson.properties != null && { properties: providerPerson.properties }),
        ...(providerPerson.created_at != null && { created_at: providerPerson.created_at }),
        ...(providerPerson.uuid != null && { uuid: providerPerson.uuid }),
        ...(providerPerson.last_seen_at != null && { last_seen_at: providerPerson.last_seen_at }),
      };
    },
  });
}
