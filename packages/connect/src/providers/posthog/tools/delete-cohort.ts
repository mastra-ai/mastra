// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteCohortInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  cohort_id: z.number().describe('Cohort ID. Example: 342249'),
});

const ProviderCohortSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  deleted: z.boolean().optional(),
});

export const deleteCohortOutputSchema = z.object({
  id: z.number(),
  deleted: z.boolean(),
  name: z.string().optional(),
});

export function deleteCohortTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_delete_cohort',
    description: 'Delete or archive a cohort in PostHog.',
    inputSchema: deleteCohortInputSchema,
    outputSchema: deleteCohortOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteCohortOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      // https://posthog.com/docs/api/cohorts
      // Hard delete is not allowed; PATCH to set deleted: true is the provider-specific archive/soft-delete semantic.
      const response = await platformProxy.patch({
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/cohorts/${encodeURIComponent(input.cohort_id)}/`,
        data: {
          deleted: true,
        },
        retries: 3,
      });

      const cohort = ProviderCohortSchema.parse(response.data);

      return {
        id: cohort.id,
        deleted: cohort.deleted ?? true,
        ...(cohort.name !== undefined && { name: cohort.name }),
      };
    },
  });
}
