import type { z } from 'zod';
// Built by scripts/build-apps.ts, inlined by tsdown.config.ts.
import html from '../apps-dist/dashboard-renderer.html?raw';
import { dashboardRendererInputSchema } from './apps/dashboard-renderer/input';
import { defineMcpAppResource } from './define-mcp-app-resource';

export { dashboardRendererInputSchema };
export {
  DASHBOARD_PIN_REQUEST_CONTEXT_KEY,
  DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY,
  dashboardPinnedWidgetSchema,
  dashboardPinnedWidgetsSchema,
} from './apps/dashboard-renderer/pin';
export type { DashboardPinnedWidget } from './apps/dashboard-renderer/pin';
export {
  DASHBOARD_DATA_TOOL_NAME,
  DASHBOARD_DATA_OPERATIONS,
  DASHBOARD_DATA_REQUESTS,
  dashboardDataInputSchema,
  dashboardDataOutputSchema,
} from './apps/dashboard-renderer/data';
export type { DashboardDataOperation, DashboardDataInput, DashboardDataOutput } from './apps/dashboard-renderer/data';

/** The `structuredContent` a tool returns to drive the dashboard app. */
export type DashboardRendererStructuredContent = z.input<typeof dashboardRendererInputSchema>;

/**
 * Renders a Mastra dashboard definition with live metrics. Link a tool to its `ui://` URI and use
 * `dashboardRendererInputSchema` as the tool's output schema. The app reads its data through
 * the `dashboardDataTool` tool, which must be registered on the same MCP server: import Mastra's from
 * `@mastra/mcp-apps-components/dashboard-data-tool`, or answer the data contract exported here.
 */
export const dashboardRendererApp = defineMcpAppResource(html, {
  name: 'Mastra dashboard',
  description: 'Renders a Mastra dashboard definition with live metrics',
});
