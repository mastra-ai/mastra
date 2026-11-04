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
import { OBSERVABILITY_APP_TOOLS, routeQuerySchema, routeResponseSchema } from './observability-protocol';
import type { ObservabilityAppToolName, RouteResponse } from './observability-protocol';

export { OBSERVABILITY_APP_TOOLS, OBSERVABILITY_PROJECT_ID_ARGUMENT } from './observability-protocol';
export type { ObservabilityAppToolName, RouteResponse } from './observability-protocol';

/** The server route behind each tool. */
export const OBSERVABILITY_APP_TOOL_ROUTES: Record<ObservabilityAppToolName, ServerRoute> = {
  observabilityAggregateTraces: AGGREGATE_TRACES,
  observabilityAggregateSpans: AGGREGATE_SPANS,
  observabilityMetricAggregate: GET_METRIC_AGGREGATE,
  observabilityMetricBreakdown: GET_METRIC_BREAKDOWN,
  observabilityMetricTimeSeries: GET_METRIC_TIME_SERIES,
  observabilityMetricPercentiles: GET_METRIC_PERCENTILES,
  observabilityListScores: LIST_SCORES,
  observabilityScoreAggregate: GET_SCORE_AGGREGATE,
  observabilityScoreBreakdown: GET_SCORE_BREAKDOWN,
  observabilityScoreTimeSeries: GET_SCORE_TIME_SERIES,
  observabilityScorePercentiles: GET_SCORE_PERCENTILES,
};

// Structural, not `instanceof`: a second installed copy of @mastra/core has its own Mastra class.
function isMastra(value: unknown): value is Mastra {
  return typeof (value as Partial<Mastra> | undefined)?.getServer === 'function';
}

function routeTool(id: ObservabilityAppToolName) {
  const route = OBSERVABILITY_APP_TOOL_ROUTES[id];
  const readsQuery = OBSERVABILITY_APP_TOOLS[id].method === 'GET';

  return createTool({
    id,
    description: route.openapi?.summary ?? `${route.method} ${route.path}`,
    inputSchema: readsQuery ? routeQuerySchema : route.bodySchema,
    outputSchema: routeResponseSchema,
    // Apps call it; hosts keep it away from the model.
    mcp: { _meta: { ui: { visibility: ['app'] } } },
    execute: async (input, { mastra, requestContext, abortSignal }): Promise<RouteResponse> => {
      if (!isMastra(mastra)) return { status: 503, body: { error: `${id} needs a Mastra instance.` } };
      return invokeRoute(route, {
        mastra,
        // Without the caller's context, a server with auth refuses the call.
        requestContext: requestContext ?? new RequestContext(),
        ...(readsQuery ? { query: routeQuerySchema.parse(input) } : { body: input }),
        abortSignal,
      });
    },
  });
}

/**
 * The app-only tools apps from this package read observability data through. Register them on
 * the MCP server that serves the apps. Each runs its Mastra route in-process as the caller, with
 * the route's own input validation, authentication, RBAC permission and FGA checks, so an app
 * sees exactly the data the signed-in user can read over HTTP.
 */
export const observabilityAppTools = Object.fromEntries(
  (Object.keys(OBSERVABILITY_APP_TOOLS) as ObservabilityAppToolName[]).map(id => [id, routeTool(id)]),
) as Record<ObservabilityAppToolName, ReturnType<typeof routeTool>>;
