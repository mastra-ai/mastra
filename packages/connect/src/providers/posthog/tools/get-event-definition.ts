// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getEventDefinitionInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  id: z.string().describe('Event definition ID. Example: "019e8cf4-5a29-75a2-970f-40e0711eaba8"'),
});

const UserSchema = z.object({
  id: z.number(),
  uuid: z.string(),
  distinct_id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string(),
  is_email_verified: z.boolean(),
  hedgehog_config: z.record(z.string(), z.unknown()),
  role_at_organization: z.string(),
});

const EventDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  owner: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  tags: z.array(z.string().nullable()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().nullable().optional(),
  updated_by: UserSchema.nullish(),
  last_seen_at: z.string().nullable().optional(),
  last_updated_at: z.string().nullable().optional(),
  verified: z.boolean().nullable().optional(),
  verified_at: z.string().nullable().optional(),
  verified_by: UserSchema.nullish(),
  hidden: z.boolean().nullable().optional(),
  enforcement_mode: z.string().optional(),
  primary_property: z.string().nullable().optional(),
  is_action: z.boolean().nullable().optional(),
  action_id: z.number().nullable().optional(),
  is_calculating: z.boolean().nullable().optional(),
  last_calculated_at: z.string().nullable().optional(),
  created_by: UserSchema.nullish(),
  post_to_slack: z.boolean().nullable().optional(),
  default_columns: z.array(z.string()).optional(),
  media_preview_urls: z.array(z.string()).optional(),
});

export const getEventDefinitionOutputSchema = EventDefinitionSchema;

export function getEventDefinitionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_get_event_definition',
    description: 'Retrieve a single event definition from PostHog.',
    inputSchema: getEventDefinitionInputSchema,
    outputSchema: getEventDefinitionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getEventDefinitionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      const response = await platformProxy.get({
        // https://posthog.com/docs/api/event-definitions
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/event_definitions/${encodeURIComponent(input.id)}/`,
        retries: 3,
      });

      if (response.status === 404) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Event definition with id ${input.id} not found.`,
          id: input.id,
        });
      }

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'empty_response',
          message: 'Received empty response from PostHog API.',
        });
      }

      const parsed = EventDefinitionSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'parse_error',
          message: 'Failed to parse event definition response.',
          details: parsed.error.message,
        });
      }

      return parsed.data;
    },
  });
}
