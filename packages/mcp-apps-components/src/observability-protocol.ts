import { z } from 'zod';

/**
 * The app-only tools apps read observability data through, with the server route each one runs.
 * Apps run in a sandboxed iframe that hosts may forbid from reaching the server, so their requests
 * travel as calls to these tools over the host's existing MCP connection instead.
 */
export const OBSERVABILITY_APP_TOOLS = {
  observabilityAggregateTraces: { method: 'POST', path: '/observability/traces/aggregate' },
  observabilityAggregateSpans: { method: 'POST', path: '/observability/spans/aggregate' },
  observabilityMetricAggregate: { method: 'POST', path: '/observability/metrics/aggregate' },
  observabilityMetricBreakdown: { method: 'POST', path: '/observability/metrics/breakdown' },
  observabilityMetricTimeSeries: { method: 'POST', path: '/observability/metrics/timeseries' },
  observabilityMetricPercentiles: { method: 'POST', path: '/observability/metrics/percentiles' },
  observabilityListScores: { method: 'GET', path: '/observability/scores' },
  observabilityScoreAggregate: { method: 'POST', path: '/observability/scores/aggregate' },
  observabilityScoreBreakdown: { method: 'POST', path: '/observability/scores/breakdown' },
  observabilityScoreTimeSeries: { method: 'POST', path: '/observability/scores/timeseries' },
  observabilityScorePercentiles: { method: 'POST', path: '/observability/scores/percentiles' },
} as const satisfies Record<string, { method: 'GET' | 'POST'; path: string }>;

export type ObservabilityAppToolName = keyof typeof OBSERVABILITY_APP_TOOLS;

/** A GET route's query string, one entry per key; repeated keys become arrays. */
export const routeQuerySchema = z.record(z.string(), z.union([z.string(), z.array(z.string())]));

/** What each tool answers: the route's own status and body, as it would over HTTP. */
export const routeResponseSchema = z.object({
  status: z.number().int(),
  body: z.unknown(),
});

export type RouteResponse = z.output<typeof routeResponseSchema>;
