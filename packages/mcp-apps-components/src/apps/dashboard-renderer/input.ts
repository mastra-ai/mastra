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
   * The project the dashboard reads, for hosts that serve several. The app sends it as `projectId`
   * on every data tool call; leave it out when the server holds one project.
   */
  projectId: z.string().min(1).optional(),
});

export type DashboardRendererInput = z.output<typeof dashboardRendererInputSchema>;
