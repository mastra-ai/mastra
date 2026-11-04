import type { DashboardWidget } from '@mastra/core/storage/dashboards';
import type { DashboardRendererInput } from './input';

/**
 * The host context key a host sets to the ids of the widgets it has pinned from this dashboard
 * (`[]` for none). The app shows a pin button on each widget only when the host sets it, and
 * follows its value.
 */
export const DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY = 'mastra.ai/dashboard-pinned-widgets';

/**
 * The notification the app sends when the user pins or unpins a widget, with the state they
 * asked for. The host updates `DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY` to match.
 */
export const DASHBOARD_WIDGET_PIN_NOTIFICATION = 'mastra.ai/dashboard-widget-pin';

/**
 * The params of `DASHBOARD_WIDGET_PIN_NOTIFICATION`: the widget as the dashboard renders it and
 * the dashboard's scope, so the host can show the pinned widget on its own.
 */
export type DashboardWidgetPinNotificationParams = {
  widget: DashboardWidget;
  scope: DashboardRendererInput['scope'];
  isPinned: boolean;
};
