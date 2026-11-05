import type { McpAppContract } from '../../define-mcp-app-ui';
import { dashboardInputSchema } from './input';

/**
 * The dashboard UI's contract: what its tool returns, and every read it makes, named after the
 * `MastraClient` method that makes it. The iframe and the server-side `dashboardUi` both build on it.
 */
export const dashboardContract = {
  uri: 'ui://mastra/dashboard',
  name: 'Mastra dashboard',
  description: 'Renders a Mastra dashboard definition with live metrics',
  dataTool: 'dashboardData',
  input: dashboardInputSchema,
  reads: {
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
  },
} as const satisfies McpAppContract;
