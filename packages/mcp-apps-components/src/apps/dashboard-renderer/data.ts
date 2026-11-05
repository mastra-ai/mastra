import { z } from 'zod';

/**
 * The app-only tool the dashboard reads its data through. The app runs in a sandboxed iframe that
 * hosts may forbid from reaching the server, so each read travels as a call to this tool over the
 * host's existing MCP connection. An MCP server names a tool by the key it's registered under, so
 * this matches the export: `tools: { dashboardDataTool }`.
 */
export const DASHBOARD_DATA_TOOL_NAME = 'dashboardDataTool';

/** Every read the dashboard makes, named after the `MastraClient` method that makes it. */
export const DASHBOARD_DATA_OPERATIONS = [
  'aggregateTraces',
  'aggregateSpans',
  'getMetricAggregate',
  'getMetricBreakdown',
  'getMetricTimeSeries',
  'getMetricPercentiles',
  'listScores',
  'getScoreAggregate',
  'getScoreBreakdown',
  'getScoreTimeSeries',
  'getScorePercentiles',
] as const;

export type DashboardDataOperation = (typeof DASHBOARD_DATA_OPERATIONS)[number];

/**
 * The Mastra route behind each read: the request `MastraClient` makes for it, without the server's
 * API prefix. A server that answers the data tool with its own routes can look them up here.
 */
export const DASHBOARD_DATA_REQUESTS = {
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

// MCP tools need an object input schema, so the operation's arguments sit in `query` or `body`
// instead of a union, and the refinement keeps each operation to the one `MastraClient` sends.
export const dashboardDataInputSchema = z
  .object({
    operation: z.enum(DASHBOARD_DATA_OPERATIONS),
    /** Query parameters, flattened to strings. Only `listScores` sends them. */
    query: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
    /** The JSON body. Every operation but `listScores` sends one. */
    body: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine(({ operation, query, body }, ctx) => {
    const sendsQuery = operation === 'listScores';
    if (sendsQuery ? body !== undefined : query !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: [sendsQuery ? 'body' : 'query'],
        message: `${operation} takes its arguments as ${sendsQuery ? 'query' : 'body'}.`,
      });
    }
  });

export type DashboardDataInput = z.output<typeof dashboardDataInputSchema>;

/** Statuses `Response.json` can't carry: informational ones, and those that forbid a body. */
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

/** What the tool answers: a status and body, as the matching Mastra route would over HTTP. */
export const dashboardDataOutputSchema = z.object({
  status: z
    .number()
    .int()
    .min(200)
    .max(599)
    .refine(status => !NULL_BODY_STATUSES.has(status), 'A dashboard read answers with a body.'),
  body: z.unknown(),
});

export type DashboardDataOutput = z.output<typeof dashboardDataOutputSchema>;
