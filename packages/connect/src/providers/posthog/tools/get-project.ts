// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getProjectInputSchema = z.object({
  project_id: z.number().describe('Project ID. Example: 309484'),
});

const ProviderProjectSchema = z
  .object({
    id: z.number(),
    uuid: z.string(),
    organization: z.string(),
    name: z.string(),
    product_description: z.string().optional().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

export const getProjectOutputSchema = ProviderProjectSchema;

export function getProjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_get_project',
    description: 'Retrieve a single project from PostHog.',
    inputSchema: getProjectInputSchema,
    outputSchema: getProjectOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getProjectOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://posthog.com/docs/api/projects
        endpoint: `/api/projects/${encodeURIComponent(String(input.project_id))}/`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Project not found',
          project_id: input.project_id,
        });
      }

      const providerProject = ProviderProjectSchema.parse(response.data);
      return providerProject;
    },
  });
}
