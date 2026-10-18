// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createCohortInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  name: z.string().describe('Cohort name. Example: "Power Users"'),
  description: z.string().optional().describe('Cohort description.'),
  filters: z
    .object({
      properties: z.object({
        type: z.string(),
        values: z.array(z.record(z.string(), z.unknown())),
      }),
    })
    .passthrough()
    .optional()
    .describe('Cohort filter definitions.'),
  is_static: z.boolean().optional().describe('Whether this is a static cohort.'),
  cohort_type: z.string().optional().describe('Cohort type. Example: "static" or "dynamic".'),
  deleted: z.boolean().optional().describe('Soft delete flag.'),
  query: z.unknown().optional().describe('Alternative query definition.'),
  _create_in_folder: z.string().optional().describe('Folder ID to create the cohort in.'),
  _create_static_person_ids: z
    .array(z.string())
    .optional()
    .describe('Person IDs to add to a static cohort on creation.'),
});

const ProviderCohortSchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  filters: z.unknown().nullable(),
  is_static: z.boolean(),
  cohort_type: z.string().nullable(),
  created_at: z.string().nullable(),
  count: z.number().nullable(),
  is_calculating: z.boolean(),
  deleted: z.boolean(),
});

export const createCohortOutputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  description: z.string().optional(),
  filters: z.unknown().optional(),
  is_static: z.boolean(),
  cohort_type: z.string().optional(),
  created_at: z.string().optional(),
  count: z.number().optional(),
  is_calculating: z.boolean(),
  deleted: z.boolean(),
});

export function createCohortTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_create_cohort',
    description: 'Create a cohort in PostHog.',
    inputSchema: createCohortInputSchema,
    outputSchema: createCohortOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createCohortOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      const config: PlatformProxyRequest = {
        // https://posthog.com/docs/api/cohorts
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/cohorts/`,
        data: {
          name: input.name,
          ...(input.description !== undefined && { description: input.description }),
          ...(input.filters !== undefined && { filters: input.filters }),
          ...(input.is_static !== undefined && { is_static: input.is_static }),
          ...(input.cohort_type !== undefined && { cohort_type: input.cohort_type }),
          ...(input.deleted !== undefined && { deleted: input.deleted }),
          ...(input.query !== undefined && { query: input.query }),
          ...(input._create_in_folder !== undefined && { _create_in_folder: input._create_in_folder }),
          ...(input._create_static_person_ids !== undefined && {
            _create_static_person_ids: input._create_static_person_ids,
          }),
        },
        retries: 3,
      };

      const response = await platformProxy.post(config);

      const providerCohort = ProviderCohortSchema.parse(response.data);

      return {
        id: providerCohort.id,
        ...(providerCohort.name != null && { name: providerCohort.name }),
        ...(providerCohort.description != null && { description: providerCohort.description }),
        ...(providerCohort.filters != null && { filters: providerCohort.filters }),
        is_static: providerCohort.is_static,
        ...(providerCohort.cohort_type != null && { cohort_type: providerCohort.cohort_type }),
        ...(providerCohort.created_at != null && { created_at: providerCohort.created_at }),
        ...(providerCohort.count != null && { count: providerCohort.count }),
        is_calculating: providerCohort.is_calculating,
        deleted: providerCohort.deleted,
      };
    },
  });
}
