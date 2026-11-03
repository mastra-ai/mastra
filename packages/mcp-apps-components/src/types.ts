/**
 * The `structuredContent` a tool returns to drive the dashboard app.
 */
export type DashboardRendererStructuredContent = {
  /** A dashboard definition, as stored by Mastra. Invalid widgets render as errors in their own cell. */
  definition: object;
  /** Which widgets, views and columns apply. Defaults to `'project'`. */
  scope?: 'org' | 'project';
  /** Mastra server the dashboard reads metrics from, e.g. `https://api.example.com`. */
  baseUrl: string;
  /** Defaults to `/api`. */
  apiPrefix?: string;
  /** Sent with every metrics request, e.g. `{ Authorization: 'Bearer …' }`. Cookies are never sent. */
  headers?: Record<string, string>;
  /** Initial time range. Defaults to `'24h'`. */
  preset?: '24h' | '3d' | '7d' | '14d' | '30d';
};

/**
 * Structurally an `AppResource` from `@mastra/mcp`, so it drops into `MCPServer`'s `appResources`.
 */
export type McpAppResource = {
  name: string;
  description: string;
  htmlPath: string;
  meta: { csp: { connectDomains: string[] } };
};
