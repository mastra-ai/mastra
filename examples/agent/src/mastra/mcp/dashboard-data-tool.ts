import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import {
  DASHBOARD_DATA_TOOL_NAME,
  dashboardDataInputSchema,
  dashboardDataOutputSchema,
} from '@mastra/mcp-apps-components/dashboard-renderer';
import type { DashboardDataOperation, DashboardDataOutput } from '@mastra/mcp-apps-components/dashboard-renderer';
import { SERVER_ROUTES, invokeRoute } from '@mastra/server/server-adapter';

// The read-only observability route that answers each read the dashboard makes. `visibility: ['app']`
// only keeps the tool away from the model; it doesn't stop a direct call, so these are all it runs.
const ROUTES = {
  aggregateTraces: 'POST /observability/traces/aggregate',
  aggregateSpans: 'POST /observability/spans/aggregate',
  getMetricAggregate: 'POST /observability/metrics/aggregate',
  getMetricBreakdown: 'POST /observability/metrics/breakdown',
  getMetricTimeSeries: 'POST /observability/metrics/timeseries',
  getMetricPercentiles: 'POST /observability/metrics/percentiles',
  listScores: 'GET /observability/scores',
  getScoreAggregate: 'POST /observability/scores/aggregate',
  getScoreBreakdown: 'POST /observability/scores/breakdown',
  getScoreTimeSeries: 'POST /observability/scores/timeseries',
  getScorePercentiles: 'POST /observability/scores/percentiles',
} satisfies Record<DashboardDataOperation, string>;

function isMastra(value: unknown): value is Mastra {
  return typeof (value as Partial<Mastra> | undefined)?.getServer === 'function';
}

// Answers each dashboard read by running its Mastra route in-process as the caller, with the route's
// own validation and permission checks, so the app sees exactly what the signed-in user can read.
export const dashboardDataTool = createTool({
  id: DASHBOARD_DATA_TOOL_NAME,
  description: 'Reads observability data for the dashboard app.',
  inputSchema: dashboardDataInputSchema,
  outputSchema: dashboardDataOutputSchema,
  // Apps call it; hosts keep it away from the model.
  mcp: { _meta: { ui: { visibility: ['app'] } } },
  execute: async (call, { mastra, requestContext, abortSignal }): Promise<DashboardDataOutput> => {
    const key = ROUTES[call.operation];
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
