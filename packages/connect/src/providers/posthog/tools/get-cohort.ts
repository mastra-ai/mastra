// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getCohortInputSchema = z.object({
  id: z.number().describe('Cohort ID. Example: 342249'),
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
});

const CreatedBySchema = z
  .object({
    id: z.number().nullable().optional(),
    uuid: z.string().nullable().optional(),
    distinct_id: z.string().nullable().optional(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    is_email_verified: z.boolean().nullable().optional(),
    hedgehog_config: z.record(z.string(), z.unknown()).nullable().optional(),
    role_at_organization: z.string().nullable().optional(),
  })
  .passthrough();

const PropertyValueSchema = z
  .object({
    bytecode: z.unknown().nullable().optional(),
    bytecode_error: z.unknown().nullable().optional(),
    conditionHash: z.unknown().nullable().optional(),
    type: z.string().nullable().optional(),
    key: z.string().nullable().optional(),
    value: z.string().nullable().optional(),
    event_type: z.string().nullable().optional(),
    time_value: z.unknown().nullable().optional(),
    time_interval: z.unknown().nullable().optional(),
    negation: z.boolean().nullable().optional(),
    operator: z.unknown().nullable().optional(),
    operator_value: z.unknown().nullable().optional(),
    seq_time_interval: z.unknown().nullable().optional(),
    seq_time_value: z.unknown().nullable().optional(),
    seq_event: z.unknown().nullable().optional(),
    seq_event_type: z.unknown().nullable().optional(),
    total_periods: z.unknown().nullable().optional(),
    min_periods: z.unknown().nullable().optional(),
    event_filters: z.unknown().nullable().optional(),
    explicit_datetime: z.unknown().nullable().optional(),
    explicit_datetime_to: z.unknown().nullable().optional(),
  })
  .passthrough();

const FiltersSchema = z
  .object({
    properties: z
      .object({
        type: z.string().nullable().optional(),
        values: z.array(PropertyValueSchema).nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough()
  .nullable()
  .optional();

export const getCohortOutputSchema = z
  .object({
    id: z.number(),
    name: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    groups: z.unknown().nullable().optional(),
    deleted: z.boolean().nullable().optional(),
    filters: FiltersSchema,
    query: z.unknown().nullable().optional(),
    version: z.number().nullable().optional(),
    pending_version: z.number().nullable().optional(),
    is_calculating: z.boolean().nullable().optional(),
    created_by: CreatedBySchema.nullable().optional(),
    created_at: z.string().nullable().optional(),
    last_calculation: z.string().nullable().optional(),
    last_backfill_person_properties_at: z.string().nullable().optional(),
    errors_calculating: z.number().nullable().optional(),
    last_error_message: z.string().nullable().optional(),
    count: z.number().nullable().optional(),
    is_static: z.boolean().nullable().optional(),
    cohort_type: z.string().nullable().optional(),
    experiment_set: z.array(z.number()).nullable().optional(),
    _create_in_folder: z.string().nullable().optional(),
    _create_static_person_ids: z.array(z.unknown()).nullable().optional(),
  })
  .passthrough();

export function getCohortTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_get_cohort',
    description: 'Retrieve a single cohort from PostHog.',
    inputSchema: getCohortInputSchema,
    outputSchema: getCohortOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getCohortOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://posthog.com/docs/api/cohorts
        endpoint: `/api/projects/${encodeURIComponent(input.project_id)}/cohorts/${encodeURIComponent(String(input.id))}/`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Cohort not found',
          id: input.id,
        });
      }

      const providerCohort = getCohortOutputSchema.parse(response.data);
      return providerCohort;
    },
  });
}
