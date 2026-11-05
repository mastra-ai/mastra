import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import {
  AGGREGATE_SPANS,
  AGGREGATE_TRACES,
  GET_METRIC_AGGREGATE,
  GET_METRIC_BREAKDOWN,
  GET_METRIC_PERCENTILES,
  GET_METRIC_TIME_SERIES,
  GET_SCORE_AGGREGATE,
  GET_SCORE_BREAKDOWN,
  GET_SCORE_PERCENTILES,
  GET_SCORE_TIME_SERIES,
  LIST_SCORES,
} from '@mastra/server/handlers/observability';
import { invokeRoute } from '@mastra/server/server-adapter';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { DASHBOARD_DATA_TOOL_NAME, dashboardDataInputSchema, dashboardDataOutputSchema } from './data';
import type { DashboardDataOperation, DashboardDataOutput } from './data';

/** The Mastra route that answers each read. */
export const DASHBOARD_DATA_ROUTES: Record<DashboardDataOperation, ServerRoute> = {
  aggregateTraces: AGGREGATE_TRACES,
  aggregateSpans: AGGREGATE_SPANS,
  getMetricAggregate: GET_METRIC_AGGREGATE,
  getMetricBreakdown: GET_METRIC_BREAKDOWN,
  getMetricTimeSeries: GET_METRIC_TIME_SERIES,
  getMetricPercentiles: GET_METRIC_PERCENTILES,
  listScores: LIST_SCORES,
  getScoreAggregate: GET_SCORE_AGGREGATE,
  getScoreBreakdown: GET_SCORE_BREAKDOWN,
  getScoreTimeSeries: GET_SCORE_TIME_SERIES,
  getScorePercentiles: GET_SCORE_PERCENTILES,
};

// Structural, not `instanceof`: a second installed copy of @mastra/core has its own Mastra class.
function isMastra(value: unknown): value is Mastra {
  return typeof (value as Partial<Mastra> | undefined)?.getServer === 'function';
}

/**
 * The app-only tool the dashboard reads its data through. Register it next to
 * `dashboardRendererApp` on the MCP server that serves the app. Each read runs its Mastra route
 * in-process as the caller, with the route's own input validation, authentication, RBAC permission
 * and FGA checks, so the app sees exactly the data the signed-in user can read over HTTP. It runs
 * only the routes in `DASHBOARD_DATA_ROUTES`. It reads the one project its server holds, so it
 * ignores a call's `projectId`.
 */
export const dashboardDataTool = createTool({
  id: DASHBOARD_DATA_TOOL_NAME,
  description: 'Reads observability data for the Mastra dashboard app.',
  inputSchema: dashboardDataInputSchema,
  outputSchema: dashboardDataOutputSchema,
  // Apps call it; hosts keep it away from the model.
  mcp: { _meta: { ui: { visibility: ['app'] } } },
  execute: async (
    { operation, query, body },
    { mastra, requestContext, abortSignal },
  ): Promise<DashboardDataOutput> => {
    if (!isMastra(mastra)) {
      return {
        status: 503,
        body: { error: `${DASHBOARD_DATA_TOOL_NAME} needs its MCP server registered on a Mastra instance.` },
      };
    }
    return invokeRoute(DASHBOARD_DATA_ROUTES[operation], {
      mastra,
      // Without the caller's context, a server with auth refuses the call.
      requestContext: requestContext ?? new RequestContext(),
      ...(query && { query }),
      ...(body && { body }),
      abortSignal,
    });
  },
});
