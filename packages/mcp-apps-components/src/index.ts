import { defineMcpAppResource } from './define-mcp-app-resource';

export type { McpAppResourceOptions } from './define-mcp-app-resource';
export type { DashboardRendererStructuredContent, McpAppResource } from './types';

/**
 * Renders a Mastra dashboard definition with live metrics. Link a tool to its `ui://` URI whose
 * `structuredContent` is a `DashboardRendererStructuredContent`.
 */
export const dashboardRendererApp = defineMcpAppResource('dashboard-renderer', {
  name: 'Mastra dashboard',
  description: 'Renders a Mastra dashboard definition with live metrics',
});
