// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteAlertInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  id: z.string().describe('Alert ID to delete. Example: "019e8d62-1ef1-0000-c642-6a68245a8aac"'),
});

export const deleteAlertOutputSchema = z.object({
  success: z.boolean(),
});

export function deleteAlertTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_delete_alert',
    description: 'Delete an alert in PostHog.',
    inputSchema: deleteAlertInputSchema,
    outputSchema: deleteAlertOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteAlertOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      // https://posthog.com/docs/api/alerts
      await platformProxy.delete({
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/alerts/${encodeURIComponent(input.id)}/`,
        retries: 3,
      });

      return {
        success: true,
      };
    },
  });
}
