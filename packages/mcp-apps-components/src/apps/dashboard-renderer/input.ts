import { DASHBOARD_SCOPES, dashboardDefinitionSchema } from '@mastra/core/storage/dashboards';
import { z } from 'zod';

/**
 * What the tool linked to the dashboard app returns as `structuredContent`. The definition is
 * core's dashboard definition; each widget's options are checked by its kind when it renders, so
 * a widget with bad options shows its error in its own cell. The initial time range and filters
 * come from the definition's `defaults`.
 */
export const dashboardRendererInputSchema = z.object({
  definition: dashboardDefinitionSchema,
  scope: z.enum(DASHBOARD_SCOPES).default('project'),
  /**
   * For hosted servers that serve many projects: the project the dashboard reads. The app sends it
   * with every data tool call as `OBSERVABILITY_PROJECT_ID_ARGUMENT`. Leave it out on self-hosted
   * servers, whose `observabilityAppTools` don't accept the extra argument.
   */
  projectId: z.string().min(1).optional(),
});

export type DashboardRendererInput = z.output<typeof dashboardRendererInputSchema>;
