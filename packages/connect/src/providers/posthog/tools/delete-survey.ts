// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteSurveyInputSchema = z.object({
  id: z.string().describe('Survey ID. Example: "497f6eca-6276-4993-bfeb-53cbbbba6f08"'),
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
});

export const deleteSurveyOutputSchema = z.object({
  success: z.boolean(),
});

export function deleteSurveyTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_delete_survey',
    description: 'Delete a survey in PostHog.',
    inputSchema: deleteSurveyInputSchema,
    outputSchema: deleteSurveyOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteSurveyOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://posthog.com/docs/api/surveys
      await platformProxy.delete({
        endpoint: `/api/projects/${encodeURIComponent(input.project_id)}/surveys/${encodeURIComponent(input.id)}/`,
        retries: 3,
      });

      return { success: true };
    },
  });
}
