import type { z } from 'zod';
// Built by scripts/build-apps.ts, inlined by tsdown.config.ts.
import html from '../apps-dist/dashboard-renderer.html?raw';
import { dashboardRendererInputSchema } from './apps/dashboard-renderer/input';
import { defineMcpAppResource } from './define-mcp-app-resource';

export { dashboardRendererInputSchema };
export { DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY, DASHBOARD_WIDGET_PIN_NOTIFICATION } from './apps/dashboard-renderer/pin';
export type { DashboardWidgetPinNotificationParams } from './apps/dashboard-renderer/pin';

/** The `structuredContent` a tool returns to drive the dashboard app. */
export type DashboardRendererStructuredContent = z.input<typeof dashboardRendererInputSchema>;

/**
 * Renders a Mastra dashboard definition with live metrics. Link a tool to its `ui://` URI and use
 * `dashboardRendererInputSchema` as the tool's output schema. The app reads metrics through
 * `observabilityAppTools` from `@mastra/mcp-apps-components/observability-tools`, which must be
 * registered on the same server.
 */
export const dashboardRendererApp = defineMcpAppResource(html, {
  name: 'Mastra dashboard',
  description: 'Renders a Mastra dashboard definition with live metrics',
});
