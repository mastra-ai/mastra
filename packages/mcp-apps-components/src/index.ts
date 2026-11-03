import type { z } from 'zod';
import { dashboardRendererInputSchema } from './apps/dashboard-renderer/input';
import { defineMcpAppResource } from './define-mcp-app-resource';

export type { McpAppResourceOptions } from './define-mcp-app-resource';
export type { McpAppResource } from './types';
export type { MastraApiRequest, MastraApiResponse } from './mastra-api';
export { MASTRA_API_TOOL } from './mastra-api';
export { mastraApiTool } from './mastra-api-tool';
export { dashboardRendererInputSchema };

/** The `structuredContent` a tool returns to drive the dashboard app. */
export type DashboardRendererStructuredContent = z.input<typeof dashboardRendererInputSchema>;

/**
 * Renders a Mastra dashboard definition with live metrics. Link a tool to its `ui://` URI and use
 * `dashboardRendererInputSchema` as the tool's output schema. The app reads metrics through
 * `mastraApiTool`, which must be registered on the same server.
 */
export const dashboardRendererApp = defineMcpAppResource('dashboard-renderer', {
  name: 'Mastra dashboard',
  description: 'Renders a Mastra dashboard definition with live metrics',
});
