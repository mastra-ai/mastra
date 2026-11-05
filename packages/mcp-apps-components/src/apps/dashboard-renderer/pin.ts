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
 * The key that pairs each pin update with the host's answer, as an MCP Apps extension key:
 *
 * - **App → host**, in `structuredContent` next to the pinned widgets: a number that grows with
 *   each update.
 * - **Host → app**, in host context: the number of the last update the host handled, whether it
 *   took the pins or not. Send it with the ids the update left you with, in the same host context
 *   change. A host that keeps its ids as they were sends nothing else, so this is how the app knows
 *   the user's click was turned down.
 */
export const DASHBOARD_PIN_REQUEST_CONTEXT_KEY = 'mastra.ai/dashboard-pin-request';

/**
 * One pinned widget: the widget as the dashboard renders it, the dashboard's scope, and, for the
 * widgets the user pins in this update, the range and filters they had on, as dashboard `defaults`.
 * Together they render the widget on its own as the user saw it. Widgets the host had already
 * pinned come without `defaults`: keep the ones you stored for them.
 */
export const dashboardPinnedWidgetSchema = z.object({
  widget: dashboardWidgetSchema,
  scope: z.enum(DASHBOARD_SCOPES),
  defaults: dashboardDefaultsSchema.optional(),
});

/**
 * The value the app sends under `DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY` in model context. It comes
 * from the app's iframe, so hosts parse it before storing or rendering anything.
 */
export const dashboardPinnedWidgetsSchema = z.array(dashboardPinnedWidgetSchema);

export type DashboardPinnedWidget = z.input<typeof dashboardPinnedWidgetSchema>;
