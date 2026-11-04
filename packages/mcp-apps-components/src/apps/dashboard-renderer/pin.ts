import { DASHBOARD_SCOPES, dashboardDefaultsSchema, dashboardWidgetSchema } from '@mastra/core/storage/dashboards';
import { z } from 'zod';

/**
 * The key both sides of dashboard pinning use, as MCP Apps extension keys:
 *
 * - **Host → app**, in host context: the ids of the widgets the host has pinned from this
 *   dashboard (`[]` for none). The app shows a pin button on each widget only while it holds an
 *   array and the host takes structured model context, and follows its value. Set it to `null` to
 *   turn pinning off: deleting the key leaves the app with the last ids it got.
 * - **App → host**, in the `structuredContent` of `ui/update-model-context`: every widget the
 *   user wants pinned after a click, parsed by `dashboardPinnedWidgetsSchema`. It is the full list,
 *   not a change, because each model context update replaces the last one. The host updates its
 *   host context ids to match. An update without the key carries no pin state; it doesn't unpin.
 */
export const DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY = 'mastra.ai/dashboard-pinned-widgets';

/**
 * One pinned widget: the widget as the dashboard renders it, the dashboard's scope, and the range
 * and filters the user had on when they pinned it, as dashboard `defaults`. Together they render
 * the widget on its own as the user saw it.
 */
export const dashboardPinnedWidgetSchema = z.object({
  widget: dashboardWidgetSchema,
  scope: z.enum(DASHBOARD_SCOPES),
  defaults: dashboardDefaultsSchema,
});

/**
 * The value the app sends under `DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY` in model context. It comes
 * from the app's iframe, so hosts parse it before storing or rendering anything.
 */
export const dashboardPinnedWidgetsSchema = z.array(dashboardPinnedWidgetSchema);

export type DashboardPinnedWidget = z.input<typeof dashboardPinnedWidgetSchema>;
