import { z } from 'zod';

/**
 * The app-only tool the dashboard reads its data through. The app runs in a sandboxed iframe that
 * hosts may forbid from reaching the server, so each read travels as a call to this tool over the
 * host's existing MCP connection. The server registering the app answers it however it likes.
 */
export const DASHBOARD_DATA_TOOL_NAME = 'mastraDashboardData';

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

/** What the tool answers: a status and body, as the matching Mastra route would over HTTP. */
export const dashboardDataOutputSchema = z.object({
  status: z.number().int(),
  body: z.unknown(),
});

export type DashboardDataOutput = z.output<typeof dashboardDataOutputSchema>;
