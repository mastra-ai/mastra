import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import {
  DASHBOARD_DATA_REQUESTS,
  DASHBOARD_DATA_TOOL_NAME,
  dashboardDataInputSchema,
  dashboardDataOutputSchema,
} from '@mastra/mcp-apps-components/dashboard-renderer';
import type { DashboardDataOutput } from '@mastra/mcp-apps-components/dashboard-renderer';
import { SERVER_ROUTES, invokeRoute } from '@mastra/server/server-adapter';

// The tool context types `mastra` as a structural copy of `Mastra`, which `invokeRoute()` doesn't
// accept. This narrows it, and is false when the MCP server isn't registered on a Mastra instance.
function isMastra(value: unknown): value is Mastra {
  return typeof (value as Partial<Mastra> | undefined)?.getServer === 'function';
}

// Answers each dashboard read by running its Mastra route in-process as the caller, with the route's
// own validation and permission checks, so the app sees exactly what the signed-in user can read.
// `visibility: ['app']` only keeps the tool away from the model; it doesn't stop a direct call, so
// the input schema's operations, and the routes behind them, are all it runs.
export const dashboardDataTool = createTool({
  id: DASHBOARD_DATA_TOOL_NAME,
  description: 'Reads observability data for the dashboard app.',
  inputSchema: dashboardDataInputSchema,
  outputSchema: dashboardDataOutputSchema,
  // Apps call it; hosts keep it away from the model.
  mcp: { _meta: { ui: { visibility: ['app'] } } },
  execute: async (call, { mastra, requestContext, abortSignal }): Promise<DashboardDataOutput> => {
    const key = DASHBOARD_DATA_REQUESTS[call.operation];
    const route = SERVER_ROUTES.find(candidate => `${candidate.method} ${candidate.path}` === key);
    if (!route) return { status: 404, body: { error: `This Mastra server has no ${key} route.` } };
    if (!isMastra(mastra))
      return { status: 503, body: { error: `${DASHBOARD_DATA_TOOL_NAME} needs a Mastra instance.` } };
    return invokeRoute(route, {
      mastra,
      // Without the caller's context, a server with auth refuses the call.
      requestContext: requestContext ?? new RequestContext(),
      ...(call.query && { query: call.query }),
      ...(call.body && { body: call.body }),
      abortSignal,
    });
  },
});
