// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteDashboardInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  id: z.number().describe('Dashboard ID. Example: 1663108'),
});

const ProviderDashboardSchema = z.object({
  id: z.number(),
  name: z.string().nullable().optional(),
  deleted: z.boolean().optional(),
});

export const deleteDashboardOutputSchema = z.object({
  id: z.number(),
  deleted: z.boolean().optional(),
  name: z.string().optional(),
});

export function deleteDashboardTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_delete_dashboard',
    description: 'Delete or archive a dashboard in PostHog.',
    inputSchema: deleteDashboardInputSchema,
    outputSchema: deleteDashboardOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteDashboardOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      // https://posthog.com/docs/api/dashboards
      // Hard delete is not allowed; PATCH deleted: true to archive the dashboard.
      const response = await platformProxy.patch({
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/dashboards/${encodeURIComponent(String(input.id))}/`,
        data: {
          deleted: true,
        },
        retries: 3,
      });

      const providerDashboard = ProviderDashboardSchema.parse(response.data);

      return {
        id: providerDashboard.id,
        ...(providerDashboard.deleted !== undefined && { deleted: providerDashboard.deleted }),
        ...(providerDashboard.name != null && { name: providerDashboard.name }),
      };
    },
  });
}
