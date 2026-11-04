import { z } from 'zod';

/**
 * The app-only tool the dashboard reads its data through. The app runs in a sandboxed iframe that
 * hosts may forbid from reaching the server, so each read travels as a call to this tool over the
 * host's existing MCP connection. The server registering the app answers it however it likes.
 */
export const DASHBOARD_DATA_TOOL_NAME = 'mastraDashboardData';

// Reads whose arguments are the JSON body `MastraClient` sends.
const BODY_OPERATIONS = [
  'aggregateTraces',
  'aggregateSpans',
  'getMetricAggregate',
  'getMetricBreakdown',
  'getMetricTimeSeries',
  'getMetricPercentiles',
  'getScoreAggregate',
  'getScoreBreakdown',
  'getScoreTimeSeries',
  'getScorePercentiles',
] as const;

/** Every read the dashboard makes, named after the `MastraClient` method that makes it. */
export const DASHBOARD_DATA_OPERATIONS = [...BODY_OPERATIONS, 'listScores'] as const;

export type DashboardDataOperation = (typeof DASHBOARD_DATA_OPERATIONS)[number];

export const dashboardDataInputSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.enum(BODY_OPERATIONS), args: z.record(z.string(), z.unknown()) }),
  // `listScores` sends its arguments as query parameters, flattened to strings.
  z.object({
    operation: z.literal('listScores'),
    args: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  }),
]);

export type DashboardDataInput = z.output<typeof dashboardDataInputSchema>;

/** What the tool answers: a status and body, as the matching Mastra route would over HTTP. */
export const dashboardDataOutputSchema = z.object({
  status: z.number().int(),
  body: z.unknown(),
});

export type DashboardDataOutput = z.output<typeof dashboardDataOutputSchema>;
