import { DASHBOARD_SCOPES, dashboardDefaultsSchema, dashboardWidgetSchema } from '@mastra/core/storage/dashboards';
import { z } from 'zod';

/**
 * The host context key a host sets to the ids of the widgets it has pinned from this dashboard
 * (`[]` for none). The app shows a pin button on each widget only while it holds an array, and
 * follows its value. Set it to `null` to turn pinning off: deleting the key leaves the app with
 * the last ids it got.
 */
export const DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY = 'mastra.ai/dashboard-pinned-widgets';

/**
 * The notification the app sends when the user pins or unpins a widget, with the state they
 * asked for. The host updates `DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY` to match.
 */
export const DASHBOARD_WIDGET_PIN_NOTIFICATION = 'mastra.ai/dashboard-widget-pin';

/**
 * The params of `DASHBOARD_WIDGET_PIN_NOTIFICATION`: the widget as the dashboard renders it, the
 * dashboard's scope, and the range and filters the user had on when they pinned it, as dashboard
 * `defaults`. Together they render the widget on its own as the user saw it. They come from the
 * app's iframe, so hosts parse them before storing or rendering anything.
 */
export const dashboardWidgetPinNotificationParamsSchema = z.object({
  widget: dashboardWidgetSchema,
  scope: z.enum(DASHBOARD_SCOPES),
  defaults: dashboardDefaultsSchema,
  isPinned: z.boolean(),
});

export type DashboardWidgetPinNotificationParams = z.input<typeof dashboardWidgetPinNotificationParamsSchema>;
