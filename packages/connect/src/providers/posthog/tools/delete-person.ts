// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deletePersonInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  person_id: z.string().describe('PostHog person ID. Example: "623209ad-6b83-5d5c-9e25-df49eba324bb"'),
});

export const deletePersonOutputSchema = z.object({
  success: z.boolean(),
  person_id: z.string(),
});

export function deletePersonTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_delete_person',
    description: 'Delete or archive a person in PostHog.',
    inputSchema: deletePersonInputSchema,
    outputSchema: deletePersonOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deletePersonOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      // https://posthog.com/docs/api/persons
      const response = await platformProxy.delete({
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/persons/${encodeURIComponent(input.person_id)}/`,
        retries: 3,
      });

      if (response.status === 404) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Person not found',
          person_id: input.person_id,
        });
      }

      return {
        success: true,
        person_id: input.person_id,
      };
    },
  });
}
